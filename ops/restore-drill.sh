#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
ARCHIVE="${1:?Informe o backup criptografado}"
KEY_FILE="${2:?Informe a chave separada}"
OUTPUT="${3:?Informe um diretório NOVO para a restauração de teste}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ ! -e "$OUTPUT" ]] || { echo 'O destino já existe. Escolha um diretório novo.' >&2;exit 2; }
mkdir -m 700 -- "$OUTPUT"
OUTPUT="$(cd -- "$OUTPUT" && pwd)"
node "$SCRIPT_DIR/archive-crypto.mjs" decrypt "$ARCHIVE" "$OUTPUT/snapshot.tar" "$KEY_FILE"
tar -tf "$OUTPUT/snapshot.tar" > "$OUTPUT/archive-files.txt"
tar -tvf "$OUTPUT/snapshot.tar" > "$OUTPUT/archive-types.txt"
if grep -Eq '(^/|(^|/)\.\.(/|$))' "$OUTPUT/archive-files.txt" || grep -Eq '^[lh]' "$OUTPUT/archive-types.txt"; then echo 'Caminho ou link inválido no backup.' >&2;exit 1;fi
tar --no-same-owner --no-same-permissions -xf "$OUTPUT/snapshot.tar" -C "$OUTPUT"
node -e 'const fs=require("fs");const p=process.argv[1];const m=JSON.parse(fs.readFileSync(p+"/manifest.json"));if(m.format!==1)process.exit(1);for(const f of ["mongo.archive.gz","uploads.tar.gz","environment.env"])if(!fs.statSync(p+"/"+f).isFile())process.exit(1)' "$OUTPUT"
tar -tzf "$OUTPUT/uploads.tar.gz" > "$OUTPUT/media-files.txt"
tar -tvzf "$OUTPUT/uploads.tar.gz" > "$OUTPUT/media-types.txt"
if grep -Eq '(^/|(^|/)\.\.(/|$))' "$OUTPUT/media-files.txt" || grep -Eq '^[lh]' "$OUTPUT/media-types.txt"; then echo 'Caminho ou link de mídia inválido.' >&2;exit 1;fi
mkdir "$OUTPUT/uploads"
tar --no-same-owner --no-same-permissions -xzf "$OUTPUT/uploads.tar.gz" -C "$OUTPUT/uploads"
CONTAINER="arcsync-restore-drill-$(date +%s)-${RANDOM}"
docker run -d --name "$CONTAINER" --network none --mount "type=bind,source=$OUTPUT,target=/restore,readonly" mongo:8.0 >/dev/null
trap 'docker stop "$CONTAINER" >/dev/null || true' EXIT
for attempt in {1..30}; do
  if docker exec "$CONTAINER" mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' >/dev/null 2>&1; then break;fi
  sleep 1
done
docker exec "$CONTAINER" mongorestore --archive=/restore/mongo.archive.gz --gzip >/dev/null 2>&1 || { echo 'Falha na restauração isolada.' >&2;exit 1; }
docker exec "$CONTAINER" mongosh --quiet --eval 'const names=db.adminCommand({listDatabases:1,nameOnly:true}).databases.map(x=>x.name).filter(x=>!["admin","config","local"].includes(x));let collections=0,documents=0;for(const n of names){const d=db.getSiblingDB(n);for(const c of d.getCollectionNames()){collections++;documents+=d.getCollection(c).countDocuments({});}} print(JSON.stringify({databases:names.length,collections,documents}));'
echo "Restauração isolada concluída. Container será parado e preservado: $CONTAINER"
echo 'O diretório contém dados sensíveis descriptografados; restrinja o acesso. Nenhum app foi iniciado.'
