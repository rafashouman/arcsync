# Operação do MVP — preparado em 02/11/2026

Estado: recursos e ensaios locais preparados. Nenhum serviço da VPS, cron externo, webhook, backup de cliente ou publicação real foi ativado.

## Fila e monitoramento

O Compose de produção possui os serviços `scheduler` e `monitor` no perfil opcional `operations`. O agendador chama a fila a cada minuto, sem sobrepor seus próprios ciclos; o banco continua protegendo as reservas entre instâncias. A publicação exige `PUBLISHING_ENABLED=true`, além das credenciais. O padrão é desativado, inclusive para chamadas manuais ao cron.

Para testar a fila com o servidor local (`npm run dev` na porta 3000), depois de definir `PUBLISHING_ENABLED=true` reinicie o servidor e execute `npm run queue:dev` em outro terminal. Esse comando carrega `.env.local` e consulta a rota a cada minuto; a publicação continua desativada enquanto a variável não for `true`. Revise todos os posts vencidos antes de habilitar o envio real.

Na etapa final, com o ambiente validado:

```sh
docker compose -f compose.production.yaml --profile operations up -d app scheduler monitor
```

Não ativar outro cron em paralelo sem necessidade. Definir `PUBLISHING_ENABLED=true` apenas quando for hora dos testes reais. O serviço `env-check` fica no perfil `checks`, separado dos serviços contínuos.

| Verificação | Comportamento |
|---|---|
| `GET /api/health` | Verifica que o processo web responde; não comprova banco nem fila |
| `GET /api/health/operations` | Exige Bearer `CRON_SECRET`; verifica banco e última execução |
| `/monitoring` | Usuário autenticado vê estado do agendador e alertas de sua equipe |
| Execução não registrada há 5 minutos | Estado `stale` |
| Execução iniciada há mais de 2 minutos sem conclusão | Estado `stuck` |
| Chamada autenticada à fila com configuração incompleta ou envio desativado | Estado `blocked` |
| Falhas em destinos durante um ciclo | Estado `degraded`; cron responde HTTP 207 |

O diário técnico guarda datas, resultado e contagem, sem conteúdo de posts/tokens, com expiração de sete dias. Esse diário técnico é diferente do histórico de publicações proposto para 180 dias.

Quando uma URL de envio do TikTok for rejeitada, o log do app registra os motivos, o domínio reconhecido e uma categoria de caminho. Não registra a URL completa, parâmetros, credenciais ou fragmento. Em Compose, consulte `docker compose -f compose.production.yaml logs app` após uma nova tentativa; não compartilhe logs sem revisá-los.

O monitor registra mudanças e recuperações em logs. `OPERATIONS_ALERT_WEBHOOK` é opcional: quando configurado, recebe somente serviço, estado, tipo de evento e data; nunca tokens, textos ou IDs de clientes. A entrega não foi ativada nem testada em um destinatário real. Se falhar, tenta novamente no próximo ciclo. O receptor deve aceitar esse JSON ou usar um adaptador.

Um monitor no mesmo servidor não detecta a queda total da própria VPS. Na etapa HTTPS, configurar também uma verificação externa autenticada de `/api/health/operations`, com o segredo guardado pelo monitor. Não colocar o segredo na URL. Conectar um canal de alerta e demonstrar recebimento/recuperação faz parte da ativação final.

## Backup criptografado

`ops/backup.sh` é destinado ao host Linux do Compose. Requer Node 24, MongoDB Database Tools (`mongodump`), Docker Compose, GNU tar e flock.

Variáveis necessárias, em um arquivo restrito ao operador:

- `FEEDSYNC_ENV_FILE`: configuração do ambiente, incluindo as chaves que permitem ler tokens restaurados.
- `FEEDSYNC_UPLOADS_HOST_DIR`: diretório persistente do ambiente.
- `BACKUP_MONGO_CONFIG`: YAML aceito pelo mongodump, com URI do banco exclusivo do app. Confirmar que não inclui bancos de outros produtos.
- `BACKUP_KEY_FILE`: arquivo separado com chave aleatória de 32 bytes em base64, diferente das chaves sociais.
- `BACKUP_OUTPUT_DIR`: diretório existente, restrito e fora do diretório de mídia.
- `BACKUP_COMPOSE_FILE`: opcional; padrão `compose.production.yaml`. Executar a partir do diretório/projeto Compose correto.

O script impede backups concorrentes, para app e scheduler, aguarda encerramento, copia banco, mídias e configuração, cria um arquivo `.fsbk` autenticado com AES-256-GCM e reinicia os serviços anteriormente ativos. Há indisponibilidade durante a cópia. Outros escritores do mesmo banco precisam estar parados também. Não usar esse procedimento como snapshot consistente de um banco compartilhado com outras aplicações ativas.

A chave do backup deve ficar separada dos arquivos e ter cópia em cofre. Perder essa chave impede restaurar. A cópia temporária sem criptografia é criada com acesso restrito e removida ao terminar; o host e seu disco também precisam de proteção. O `.fsbk` contém credenciais e deve ser tratado como sensível.

O timer `ops/arcsync-backup.timer` prepara execução diária às 03h no fuso do servidor. Ajustar os caminhos da unit para staging/produção, criar `/etc/arcsync/backup.env` e validar um backup manual antes de instalar/ativar o timer. O arquivo fornecido não foi instalado. Encaminhar falhas da unit ao monitor operacional e monitorar a idade do último backup. Copiar os arquivos criptografados para armazenamento independente da VPS na etapa final.

## Restauração e ensaio

```sh
bash ops/restore-drill.sh /caminho/backup.fsbk /caminho/chave /caminho/novo-diretorio
```

O destino deve ser novo. O script autentica/descriptografa o arquivo, confere caminhos e recusa links nos arquivos tar, restaura as mídias e o dump em um container Mongo sem rede nem porta publicada. Nenhum app/worker é iniciado; tokens restaurados não podem publicar. O container é parado e preservado para inspeção. A saída deve ser comparada com os registros esperados do backup. O diretório resultante contém dados sensíveis e deve ser removido pelo operador após a conferência, conforme a política aplicável.

Para uma recuperação real, primeiro restaurar em ambiente isolado, conferir amostra de documentos/índices/mídias, recuperar as chaves e validar acessos. Manter `PUBLISHING_ENABLED=false`. Posts vencidos ou com envio incerto precisam de revisão antes de religar a fila; não alterar o banco para forçar reenvio. Definir a promoção do ambiente recuperado e a reversão com o responsável.

Ensaio local executado: documento Mongo e índice único, mídia e configuração fictícia sobreviveram ao backup criptografado e à restauração em Mongo isolado. Chave errada e adulteração são recusadas. A orquestração completa de parada/reinício no host Linux ainda deve ser verificada na instalação final; scripts passaram na verificação de sintaxe.

## Limites das verificações locais

Teste de carga funcional: 32 reservas concorrentes para 24 posts, sem duplicidade. Recuperação após desconexão/reconexão e reserva expirada preserva resultado incerto e impede escrita do trabalhador antigo. Isso não mede vazão, latência ou cotas dos provedores reais, nem substitui um teste de queda da VPS.

Comandos: `npm test`, `npm run test:operations`, `npm run test:backup`, `npm run test:integration`, `npm run test:providers`. Integrações usam apenas Mongo local de testes na porta 27119. Não executar ensaios de carga junto de dados reais.

## Revisão de retenção sem alterar dados

`npm run retention:report -- --workspace ID_EXATO_DA_EQUIPE` gera uma prévia JSON somente de leitura. `--backup-dir` acrescenta inspeção da pasta de backups do operador (não restrita à equipe). Configuração, critérios conservadores e limites estão em `POLITICA-RETENCAO-PROPOSTA.md`. O relatório não verifica referências de mídia nem autoriza exclusão. `npm run test:retention` valida isolamento e preservação usando dados fictícios em `feedsync_mvp_retention`, na porta local 27119.


## Ajustes da revisão de 03/11/2026

Os parâmetros de interpolação do Compose, permissões de volume, banco e SMTP estão nas seções 2 e 11 de `GUIA-CONFIGURACAO-REDES.md`. Recriar containers para recarregar variáveis; `restart` sozinho não basta. O perfil operacional só deve ser liberado após revisar agendamentos vencidos.

Quando `PUBLISHING_ENABLED=false`, o serviço scheduler não chama a rota: o monitor pode mostrar `missing` (sem execução) ou `stale` (registro antigo). `blocked` é registrado quando a rota autenticada é efetivamente chamada e recusa a execução. Isso evita interpretar a preparação desativada como prova de que a fila está operando.

Home e calendário são páginas diferentes: `/` e `/calendar`. Os endpoints de saúde e cron continuam iguais. O diário técnico de sete dias permanece distinto da proposta 180/30 e dos relatórios de retenção, que não apagam conteúdos.
