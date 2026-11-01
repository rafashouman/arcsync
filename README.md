# FeedSync

FeedSync é um MVP de calendário editorial para planejar posts de Instagram,
TikTok e YouTube. Inclui visualização em calendário e lista, filtros por rede,
criação/edição/exclusão de agendamentos e rascunhos, autenticação própria com
MongoDB, workspaces compartilhados, equipe e aprovação de conteúdo.

## Executar localmente

Requisitos: Node.js 24.12 ou superior.

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Configuração

1. Configure `MONGODB_URI` para autenticação e persistência de usuários,
   sessões, posts e contas. Sem MongoDB, o login/cadastro não funciona e os
   posts ficam apenas em memória, sem sobreviver à reinicialização. A URI de
   `localhost` usada no desenvolvimento não deve ser copiada para produção.
2. Para permitir recuperação de senha, configure `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM`. `PUBLIC_APP_URL` deve apontar
   para a origem pública do app (HTTPS em produção); o link de redefinição é
   enviado por e-mail, expira em uma hora e pode ser usado uma única vez.
   Use `SMTP_PORT=587` para SMTP com STARTTLS ou `465` para TLS implícito.
3. Para publicar posts do Instagram, configure também `PUBLIC_APP_URL` com a
   URL HTTPS pública do app, `MEDIA_URL_SIGNING_KEY` com uma chave aleatória
   base64 de 32 bytes e `CRON_SECRET` com pelo menos 32 caracteres aleatórios.
   Gere a chave de mídia com:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Gere o segredo do cron com:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

Não envie nem versione credenciais: `.env.local` está ignorado pelo Git.

## Produção no VPS

O FeedSync está publicado em
[https://feedsync.focuspulse.site](https://feedsync.focuspulse.site), em um VPS
com Ubuntu 26.04 LTS. O domínio principal existente continua no mesmo servidor;
o FeedSync usa um subdomínio e um virtual host Nginx próprios. O HTTPS é
gerenciado pelo Certbot, com renovação automática.

O Next.js roda como serviço `feedsync`, em `127.0.0.1:3001`, atrás do Nginx.
Os uploads persistem em `/opt/feedsync/uploads`. O MongoDB de produção é uma
instância isolada do aplicativo, com autenticação, limitada a
`127.0.0.1:27018` e usuário com acesso de leitura e gravação somente ao banco
`feedsync`. A instância MongoDB preexistente do VPS não é usada pelo FeedSync.
Configure os segredos de produção em `/opt/feedsync/.env.production`; esse
arquivo não deve ser versionado nem substituído pela URI local de
desenvolvimento.

O cron chama `POST /api/cron/publish` a cada minuto usando um segredo mantido
fora do repositório. A fila publica no Instagram ou YouTube quando as
credenciais correspondentes estão configuradas. O cadastro e o login usam a
instância MongoDB isolada do FeedSync; senhas são armazenadas com scrypt e as
sessões são tokens aleatórios guardados em cookies `httpOnly`, com seus hashes
no banco. A recuperação de senha por e-mail está implementada; configure as
variáveis SMTP no `.env.production` para habilitá-la neste ambiente.

### Deploy de homologação pelo GitHub

O workflow `.github/workflows/deploy-vps-staging.yml` é **manual** e só aceita
execução a partir da branch `main`, após testes, lint, type-check e build
passarem. Ele publica exclusivamente em `/opt/feedsync-staging`, no serviço
`feedsync-staging` e na porta local `3002`; não altera o deploy de produção em
`/opt/feedsync`. A transferência exclui `.env*`, `uploads/`, `.next/`,
`node_modules/` e `.git/`. O diretório `shared/uploads` persiste entre versões,
e releases são ativadas por symlink; uma falha no health check restaura a versão
anterior.

Antes de habilitar o workflow:

1. No GitHub, crie o Environment `staging` e configure os secrets
   `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY` e `VPS_KNOWN_HOSTS`. Use uma
   chave SSH dedicada ao deploy e um `known_hosts` cuja fingerprint foi
   verificada fora do GitHub Actions. Não coloque nenhum segredo no repositório.
2. Na VPS, prepare Node.js 24.12+ e `npm` em `/usr/bin`, além de `rsync`, `curl`,
   `systemd`, Nginx e Certbot. Crie o grupo e usuário de serviço
   `feedsync-staging`, separados do serviço de produção `feedsync`, e um usuário
   SSH de deploy dedicado. Adicione o usuário de deploy aos grupos
   `feedsync-staging` e `feedsync-staging-deploy`; crie o segundo grupo e
   instale [feedsync-staging-deploy.sudoers](./ops/hostinger/feedsync-staging-deploy.sudoers)
   em `/etc/sudoers.d/feedsync-staging-deploy` com modo `0440`, validando-o com
   `visudo -cf`. Esse arquivo limita o sudo às operações do serviço de staging.
3. Crie `/opt/feedsync-staging` e `shared` como `root:feedsync-staging` com
   modo `0750`; crie `releases` como `<deploy-user>:feedsync-staging` com modo
   `2770`, e `shared/uploads` como `feedsync-staging:feedsync-staging` com modo
   `0750`. Crie `/opt/feedsync-staging/shared/.env.production` como
   `root:feedsync-staging`, modo `0640`; o usuário de deploy precisa lê-lo para
   validar e construir o app, mas não alterá-lo. Configure-o diretamente na
   VPS com `PUBLIC_APP_URL=https://staging.feedsync.focuspulse.site`, um banco
   MongoDB de homologação separado da produção e as demais variáveis exigidas
   por `npm run check:env -- --production`. Não configure OAuth social ainda;
   os testes reais continuam reservados para a etapa final.
4. Instale [feedsync-staging.service](./ops/hostinger/feedsync-staging.service)
   em `/etc/systemd/system/feedsync-staging.service`, execute
   `systemctl daemon-reload` e habilite o serviço. Instale
   [nginx-staging.conf](./ops/hostinger/nginx-staging.conf) como um site Nginx
   separado e valide/recarregue o Nginx. O proxy usa somente `127.0.0.1:3002`;
   o limite de corpo de 100 MB permite os uploads aceitos pelo aplicativo.
5. Depois de versionar e enviar as alterações à `main`, abra **Actions →
   Deploy FeedSync staging to Hostinger VPS → Run workflow** e digite
   `deploy-staging`. Após o primeiro deploy, valide o proxy localmente; então
   crie no DNS um registro A para `staging.feedsync.focuspulse.site` apontando
   para o IP da VPS. Quando o DNS resolver, emita o certificado com Certbot e
   habilite o redirecionamento HTTP → HTTPS. A produção permanece no host e
   serviço atuais.

O workflow não foi executado e nenhum arquivo foi enviado à VPS. O script
`npm run check:env -- --production` valida somente a configuração local; não
acessa nem revela o `.env.production` remoto.

### Conectar Instagram

1. No Meta for Developers, crie um app do tipo **Business**, configure
   **Instagram API with Instagram Login** e habilite o caso de uso de publicação
   de conteúdo.
2. Cadastre a URI de callback exatamente como
   `https://seu-dominio/api/social/meta/callback` (localmente,
   `http://localhost:3000/api/social/meta/callback`) na lista de OAuth Redirect
   URIs do app.
3. Configure `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` e
   `INSTAGRAM_REDIRECT_URI` em `.env.local`.
4. Gere uma chave exclusiva de 32 bytes para criptografia dos tokens e defina
   `SOCIAL_TOKEN_ENCRYPTION_KEY`. Exemplo de geração:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

5. Reinicie o servidor e abra **Contas sociais**. O app solicita
   `instagram_business_basic` e `instagram_business_content_publish`.

O acesso de contas fora dos papéis de teste pode exigir Advanced Access e
aprovação de App Review da Meta. Tokens são guardados no MongoDB criptografados
com AES-256-GCM; configure MongoDB e a chave antes de conectar contas. A
renovação manual fica disponível depois de 24 horas, enquanto o token ainda for
válido, conforme os requisitos da Meta. Consulte a documentação oficial de
[Business Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/)
e [Content Publishing](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/).
Na tela **Contas sociais**, escolha uma conta padrão para a publicação. O worker
suporta fotos JPG, vídeos MP4/MOV como Reels e carrosséis de 2 a 10 mídias; PNG,
WEBP, GIF e outros formatos aceitos para upload ainda não são aceitos pelo
publicador do Instagram.

### Conectar TikTok e YouTube

As conexões OAuth do TikTok e do YouTube podem ser configuradas separadamente
do Instagram. Defina `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` e
`TIKTOK_REDIRECT_URI` para o app cadastrado no TikTok for Developers; o callback
deve ser `https://seu-dominio/api/social/tiktok/callback`. O TikTok exige
HTTPS para o redirect URI, inclusive no desenvolvimento local.

Para o YouTube, habilite a YouTube Data API v3 no projeto Google Cloud e defina
`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` e `YOUTUBE_REDIRECT_URI`. Cadastre
`https://seu-dominio/api/social/youtube/callback` no cliente OAuth; em
desenvolvimento, `http://localhost:3000/api/social/youtube/callback` é aceito.
O app solicita autorização para envio de vídeos e leitura do canal.

As duas conexões exigem MongoDB e `SOCIAL_TOKEN_ENCRYPTION_KEY`. A autorização
OAuth permite conectar, selecionar a conta padrão, renovar o token e
desconectar.

O TikTok consulta as opções atuais do criador antes de agendar e publicar.
Configure `TIKTOK_CLIENT_AUDITED=true` somente depois que o app passar pela
auditoria do TikTok for Developers. Sem auditoria, o FeedSync restringe a
privacidade a **Somente você** e limita a cinco contas distintas iniciando
publicações em qualquer janela de 24 horas. O limite é compartilhado por todas as instâncias
do app e armazenado no MongoDB. O editor exige escolha manual de privacidade,
confirmação de direitos do vídeo/música e declaração de conteúdo comercial; as
interações indisponíveis na conta são desabilitadas. Vídeos devem respeitar o
limite de duração retornado pelo TikTok e o limite local de 95 MB. O worker
valida novamente a duração lendo os metadados do MP4/MOV ou WebM antes de
iniciar o upload; arquivos sem metadados de duração válidos são recusados.

## Sessão, dados e mídia

O MongoDB armazena as contas de e-mail/senha; as senhas usam scrypt e o servidor
mantém tokens de sessão aleatórios em cookies `httpOnly`, `SameSite=Lax`, com
validade de cinco dias. Apenas o hash do token fica no banco. Cada leitura,
criação, alteração ou exclusão de post verifica a sessão e limita as consultas
ao workspace ativo do usuário autenticado. O cadastro é aberto e a verificação
de e-mail ainda não está disponível. A recuperação usa um token aleatório
armazenado apenas como hash, limita solicitações e encerra as sessões existentes
após a troca de senha; respostas de solicitação não revelam se o endereço está
cadastrado.

Uploads são armazenados fora de `public/` em `uploads/`, particionados por
workspace, e servidos por uma rota que exige a mesma sessão. São aceitos JPG,
PNG, WEBP, GIF, MP4, MOV e WEBM; até 10 arquivos por post e 95 MB por envio.
Esse diretório local não é durável em plataformas serverless: antes de um deploy
desse tipo, configure armazenamento persistente/privado. `FEEDSYNC_UPLOADS_DIR`
permite apontar para um diretório absoluto em um volume persistente; se estiver
vazio, o padrão é `<projeto>/uploads`.

Posts legados do MongoDB, criados antes da autenticação e sem `userId`, não são
mostrados nem atribuídos automaticamente a uma conta. Faça uma migração
controlada após decidir qual usuário deve ser o proprietário.

Rascunhos podem ser salvos sem escolher rede, mídia ou horário. Eles ficam
separados dos posts no calendário e podem ser editados, excluídos ou convertidos
em agendamento quando estiverem prontos.
Posts existentes também podem ser duplicados como rascunhos, preservando
legenda, redes, fuso e mídias sem criar um novo envio automático.

Cada post agendado salva o fuso IANA selecionado no momento da edição. A agenda
exibe a hora nesse fuso e usa a mesma referência ao publicar; horários locais
inexistentes durante a mudança para o horário de verão são recusados. Quando
um horário ocorre duas vezes na mudança para o horário padrão, a primeira
ocorrência é usada.
Na visualização mensal, posts ainda agendados podem ser arrastados para outro
dia; a operação mantém o horário e fuso originais e recusa um destino passado
ou um horário inexistente por mudança de fuso.

O editor inclui uma prévia aproximada do conteúdo e valida os requisitos de
cada rede antes de agendar: Instagram aceita legenda de até 2.200 caracteres e
de 1 a 10 mídias JPG, MP4 ou MOV; YouTube exige um vídeo MP4, MOV ou WEBM e usa
a primeira linha da legenda como título; TikTok exige um vídeo MP4, MOV ou
WEBM e consulta as opções disponíveis da conta antes do agendamento.

## Workspaces, equipe e aprovações

Cada usuário pertence a um workspace ativo; a criação do primeiro workspace
migra para ele os posts e as contas sociais antigos do usuário. É possível
participar de mais de uma equipe e alternar o workspace ativo em **Equipe**.
Contas sociais e mídias novas pertencem ao workspace e são compartilhadas.
Proprietários e administradores conectam, renovam, definem como padrão e
removem contas sociais.

Os papéis disponíveis são **Proprietário**, **Administrador**, **Editor** e
**Aprovador**. Editores criam posts agendados que ficam aguardando aprovação;
proprietários, administradores e aprovadores revisam, e a rejeição exige um
comentário. O cron não publica posts pendentes ou rejeitados. Posts escritos
por proprietário/administrador não exigem revisão. Aprovadores têm acesso de
leitura ao calendário e não podem criar ou alterar posts. Um resultado incerto
de publicação permanece protegido contra retentativa, inclusive no fluxo da equipe.

Convites são links de uso único, válidos por sete dias, e vinculados ao e-mail
convidado. No MVP o link é copiado e compartilhado manualmente; o FeedSync ainda
não envia e-mails transacionais.

## Analytics

A tela **Analytics** resume publicações, agendamentos e falhas registrados pelo
FeedSync por rede. Ela também consulta visualizações, marcações de gostei e
comentários dos vídeos publicados no YouTube, usando a permissão
`youtube.readonly`; os totais são acumulados, atualizados ao abrir a tela e
limitados aos 50 vídeos mais recentes publicados pelo app.

Instagram e TikTok exibem explicitamente que métricas nativas ainda não estão
disponíveis: os escopos de insights dessas plataformas não fazem parte do fluxo
de autorização atual. A contagem operacional de posts continua disponível e
não é apresentada como alcance ou engajamento.

## Fila e publicação agendada

O endpoint `POST /api/cron/publish` processa um post vencido por chamada e exige
`Authorization: Bearer <CRON_SECRET>`. Configure um cron externo para chamá-lo
periodicamente (por exemplo, a cada minuto). A conta precisa estar conectada e
definida como padrão, e a mídia precisa estar disponível na URL HTTPS pública do
app durante o processamento.

O worker publica no Instagram, TikTok e YouTube. No TikTok, os vídeos são
enviados em blocos e o estado de processamento é consultado antes de marcar
uma publicação como concluída. A URL de envio e o identificador da publicação
são persistidos para retomar o trabalho sem iniciar outro post. Um post
selecionado para várias redes é processado em etapas independentes; cada
resultado fica visível no calendário. Redes já publicadas são preservadas
quando há falha em outra rede, e a retentativa manual atua somente nas falhas
confirmadas. No YouTube,
vídeos são enviados em blocos resumíveis de 8 MiB e ficam públicos após o
envio; uma interrupção no bloco final é marcada como incerta para evitar
publicar duplicatas. Falhas transitórias são tentadas novamente; confira o
status por plataforma no calendário.
Resultados incertos não oferecem retentativa manual por segurança.
Uploads locais não são duráveis em ambientes serverless; use armazenamento
persistente acessível publicamente por HTTPS antes de publicar nesses ambientes.

## Verificações

```powershell
npm run check:env
npm run check:env -- --production
npm run lint
npm run build
npm test
```

`check:env` valida localmente as variáveis obrigatórias sem exibir seus valores
nem fazer conexões externas; não confirma conectividade do MongoDB, envio SMTP
nem disponibilidade das APIs sociais. O modo `--production` também exige HTTPS
nas URLs públicas e de callback e avisa que `uploads/` precisa estar em volume
persistente fora de ambientes serverless. Avisos de OAuth indicam configurações
ainda não testadas; não substituem a etapa final com contas de teste das plataformas.
