#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${FEEDSYNC_ENV_FILE:?Informe o arquivo de ambiente a incluir no backup}"
: "${FEEDSYNC_UPLOADS_HOST_DIR:?Informe a pasta persistente de mídias}"
: "${BACKUP_MONGO_CONFIG:?Informe o YAML de configuração de mongodump}"
: "${BACKUP_KEY_FILE:?Informe o arquivo da chave de backup}"
: "${BACKUP_OUTPUT_DIR:?Informe o diretório de saída}"
for command in node mongodump tar docker flock; do command -v "$command" >/dev/null || { echo "Comando necessário: $command" >&2;exit 1;};done
[[ -f "$FEEDSYNC_ENV_FILE" && -d "$FEEDSYNC_UPLOADS_HOST_DIR" && -f "$BACKUP_MONGO_CONFIG" && -f "$BACKUP_KEY_FILE" && -d "$BACKUP_OUTPUT_DIR" ]] || exit 2
exec 9>"$BACKUP_OUTPUT_DIR/.backup.lock"
flock -n 9 || { echo 'Outro backup está em execução.' >&2;exit 1; }
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${BACKUP_COMPOSE_FILE:-compose.production.yaml}"
TEMP_DIR="$(mktemp -d)"
RUNNING="$(docker compose -f "$COMPOSE_FILE" --profile operations ps --services --status running | awk '$0=="app" || $0=="scheduler"')"
[[ "$RUNNING" == *app* ]] || { echo 'App não está em execução neste projeto; confira o contexto do backup.' >&2;rmdir "$TEMP_DIR";exit 2; }
cleanup() {
  local status=$?
  # TEMP_DIR is created by mktemp, not derived from caller-supplied paths.
  rm -rf -- "$TEMP_DIR"
  while IFS= read -r service; do
    if [[ -n "$service" ]]; then docker compose -f "$COMPOSE_FILE" --profile operations start "$service" >/dev/null || status=1; fi
  done <<< "$RUNNING"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker compose -f "$COMPOSE_FILE" --profile operations stop -t 120 scheduler app >/dev/null
mkdir "$TEMP_DIR/snapshot"
mongodump --config="$BACKUP_MONGO_CONFIG" --archive="$TEMP_DIR/snapshot/mongo.archive.gz" --gzip >"$TEMP_DIR/mongodump.log" 2>&1 || { echo 'Falha ao copiar o banco; detalhes não são exibidos para proteger credenciais.' >&2;exit 1; }
cp -- "$FEEDSYNC_ENV_FILE" "$TEMP_DIR/snapshot/environment.env"
tar -czf "$TEMP_DIR/snapshot/uploads.tar.gz" -C "$FEEDSYNC_UPLOADS_HOST_DIR" .
printf '{"format":1,"createdAt":"%s","includes":["database","uploads","environment"]}\n' "$(date -u +%FT%TZ)" > "$TEMP_DIR/snapshot/manifest.json"
tar -cf "$TEMP_DIR/snapshot.tar" -C "$TEMP_DIR/snapshot" .
OUTPUT="$BACKUP_OUTPUT_DIR/arcsync-$(date -u +%Y%m%dT%H%M%SZ)-${RANDOM}.fsbk"
node "$SCRIPT_DIR/archive-crypto.mjs" encrypt "$TEMP_DIR/snapshot.tar" "$OUTPUT" "$BACKUP_KEY_FILE"
echo 'Backup criptografado concluído. Serviços anteriormente ativos serão reiniciados.'
