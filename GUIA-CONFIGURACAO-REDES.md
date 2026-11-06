# Arcsync — tutorial de configuração das redes sociais

Revisão: 3 de novembro de 2026. Este guia prepara a configuração; não altera credenciais nem publica conteúdo. Nomes dos menus podem mudar. Requisitos devem ser confirmados no painel do aplicativo antes de submetê-lo.

## 1. O que você precisa reunir

- Domínio/subdomínio HTTPS definitivo para homologação e, depois, produção.
- E-mail de suporte, nome/logo/descrição do Arcsync, URLs públicas de privacidade, termos e instruções de exclusão.
- Acesso administrativo ao servidor e ao DNS.
- Conta Google com canal YouTube de teste.
- Conta TikTok de teste e acesso ao TikTok for Developers.
- Conta Meta de desenvolvedor, Instagram profissional e Página Facebook de teste com permissão para publicar.
- Dados empresariais/documentação quando solicitados na revisão.

O app inclui Instagram, TikTok, YouTube e Facebook Pages, sujeitos à homologação real. Facebook começa com texto ou uma foto JPG/PNG no feed; não inclui perfil pessoal, grupos, Stories, Reels ou carrossel.

## 2. Preparar o servidor

Escolha uma única origem para cada ambiente. Nos exemplos, `https://app.seu-dominio.com` é um endereço ilustrativo: substitua-o pelo domínio real. Não misture credenciais, banco, chaves ou callbacks de homologação com produção.

Configure no ambiente do serviço/container:

```dotenv
MONGODB_URI=<conexao-do-banco-do-ambiente>
PUBLIC_APP_URL=https://app.seu-dominio.com
FEEDSYNC_UPLOADS_DIR=/app/uploads
SOCIAL_TOKEN_ENCRYPTION_KEY=<chave-base64-de-32-bytes>
MEDIA_URL_SIGNING_KEY=<outra-chave-base64-de-32-bytes>
CRON_SECRET=<segredo-aleatorio-com-pelo-menos-32-caracteres>
LEGAL_OPERATOR_NAME=NexuSync
SUPPORT_EMAIL=contato@nexusync.online
PUBLISHING_ENABLED=false
OPERATIONS_ALERT_WEBHOOK=
SMTP_HOST=<servidor-smtp>
SMTP_PORT=587
SMTP_USER=<usuario-smtp>
SMTP_PASSWORD=<senha-smtp>
SMTP_FROM=<remetente-autorizado>
```

`/app/uploads` é o caminho dentro do container: monte um volume persistente nele. Em execução direta na VPS, use o caminho absoluto real do servidor. Não basta apontar para uma pasta temporária.

Gere separadamente cada chave base64 em um terminal administrativo confiável:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Para o segredo do cron:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarde os valores no gerenciador de segredos/ambiente do servidor. Não cole secrets no chat, no código, em capturas de tela ou no Git. Preserve a chave de criptografia: trocá-la sem migração impede ler os tokens existentes. Em Docker Compose, recrie os containers após alterar variáveis: apenas `restart` não recarrega o arquivo de ambiente. Use `up -d --force-recreate` para os serviços afetados. Em execução direta, reinicie o processo com o ambiente atualizado.

Escolha o agendador do perfil `operations` do Compose (seção 10) ou um cron externo. Não é necessário usar ambos. Para cron externo, configure a chamada a cada minuto:

- Método: `POST`
- URL: `https://app.seu-dominio.com/api/cron/publish`
- Cabeçalho: `Authorization: Bearer <CRON_SECRET>`

Use o mecanismo de segredo do agendador. Registre status e duração sem registrar o cabeçalho. Um GET no navegador não testa esse endpoint. Sem o cron, o calendário pode salvar agendamentos, mas a fila não será executada automaticamente.

Valide `npm run check:env -- --production` no ambiente configurado. Esse comando não comprova conectividade das APIs nem publicação. SMTP serve à recuperação de senha; não é usado para publicar nas redes.

## 3. YouTube — configuração

1. Abra [Google Cloud Console](https://console.cloud.google.com/) e crie/selecione o projeto do Arcsync.
2. Em APIs e serviços, habilite **YouTube Data API v3**.
3. Configure o Google Auth Platform/tela de consentimento: nome, contato, domínio e páginas públicas. Escolha a audiência compatível com seu produto. Durante testes externos, adicione os e-mails autorizados como usuários de teste.
4. Cadastre um cliente OAuth do tipo **Aplicativo da Web**. Em URIs de redirecionamento autorizadas, adicione exatamente:
   `https://app.seu-dominio.com/api/social/youtube/callback`
5. Configure no servidor:

```dotenv
YOUTUBE_CLIENT_ID=<client-id-do-google>
YOUTUBE_CLIENT_SECRET=<client-secret-do-google>
YOUTUBE_REDIRECT_URI=https://app.seu-dominio.com/api/social/youtube/callback
```

6. Reinicie o Arcsync. Abra **Contas sociais → YouTube → Conectar**, entre com a conta do canal de teste e confira qual canal foi autorizado.
7. O código solicita `https://www.googleapis.com/auth/youtube.upload` e `https://www.googleapis.com/auth/youtube.readonly`. Autorize ambos; a segunda permissão é usada para dados do canal/métricas. Para disponibilizar a clientes, siga a verificação OAuth exigida pelo Google para esses acessos. [Escopos oficiais](https://developers.google.com/youtube/v3/guides/auth/client-side-web-apps)
8. Crie um destino YouTube e envie um vídeo pequeno de teste. O limite local atual é 95 MB por envio; não confunda isso com o limite maior da API.

No destino YouTube, ative **Personalizar configurações do YouTube** para definir título, descrição, público/não listado/privado e declarações de conteúdo infantil e sintético. Sem personalização, usa a legenda e envia como **privado**. Shorts não é um parâmetro dedicado do conector. [Campos oficiais](https://developers.google.com/youtube/data/reference/rest/v3/videos)

**Conexão que expira:** em projeto OAuth externo com status Testing, refresh tokens para esses escopos expiram em sete dias. Isso não equivale a um bug de renovação do Arcsync. Para operação contínua, conclua a configuração de produção e verificação aplicável. [OAuth do Google](https://developers.google.com/identity/protocols/oauth2)

A referência atual de `videos.insert` consultada não impõe mais a antiga restrição universal de privado para projetos não verificados. Confira a privacidade efetiva do vídeo e as cotas no projeto; não baseie a homologação em tutoriais antigos que pressupõem essa restrição. [Referência atual de upload](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert)

## 4. TikTok — configuração

1. Acesse [TikTok for Developers](https://developers.tiktok.com/) e registre o aplicativo web do Arcsync.
2. Preencha nome, descrição, ícone, site, privacidade e termos. Verifique a propriedade das URLs solicitadas pelo painel, por DNS ou arquivo conforme as instruções fornecidas. [Cadastro oficial](https://developers.tiktok.com/docs/en/getting-started-create-an-app)
3. Configure Login Kit e Content Posting API. Habilite **Direct Post**; o fluxo de enviar conteúdo para a caixa de entrada do TikTok é diferente.
4. Solicite os escopos usados pelo código: `user.info.basic` e `video.publish`. A disponibilidade de `video.publish` depende da aprovação do aplicativo e do consentimento da conta.
5. Cadastre exatamente o callback HTTPS:
   `https://app.seu-dominio.com/api/social/tiktok/callback`
6. Configure:

```dotenv
TIKTOK_CLIENT_KEY=<client-key>
TIKTOK_CLIENT_SECRET=<client-secret>
TIKTOK_REDIRECT_URI=https://app.seu-dominio.com/api/social/tiktok/callback
TIKTOK_CLIENT_AUDITED=false
```

7. Cadastre as contas de teste conforme o modo disponibilizado no painel; depois conecte pelo Arcsync.
8. No editor, confira nome da conta, privacidade, duração permitida, interações e consentimentos. Teste a conclusão no TikTok, não apenas o recebimento do upload. [Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-get-started)

**Antes da auditoria:** as diretrizes atuais restringem clientes não auditados a até cinco usuários em 24 horas, contas privadas e visibilidade `SELF_ONLY`. O produto deve atender uma audiência real; uma ferramenta exclusivamente interna para as contas do próprio time é indicada como uso não aceito. Isso pode afetar a aprovação e não se resolve com um secret. [Diretrizes oficiais](https://developers.tiktok.com/docs/en/content-sharing-guidelines)

**Envio implementado:** novos vídeos usam `PULL_FROM_URL`, com URL assinada por 48 horas gerada no momento do envio. Em Manage URL properties no painel TikTok, verifique o domínio/prefixo usado por `PUBLIC_APP_URL/api/media/`. As URLs precisam ser acessíveis sem login, redirecionamento ou bloqueio de robôs. Sessões antigas de upload por blocos continuam compatíveis para conclusão. Se o início não retornar confirmação, o histórico bloqueia reenvio automático; confira a conta antes de reconciliar. A aprovação depende também da experiência de usuário, não só da conectividade.

Só altere `TIKTOK_CLIENT_AUDITED=true` depois de aprovação real da auditoria. A variável não concede acesso nem remove restrições no TikTok.

## 5. Instagram — configuração

O Arcsync usa **Instagram API with Instagram Login**, com callback que contém `meta`. Não selecione automaticamente o fluxo “Instagram with Facebook Login”: ele tem permissões e dependências diferentes.

1. Abra [Meta for Developers](https://developers.facebook.com/) e crie/selecione um app com o caso de uso/produto Instagram e publicação de conteúdo.
2. Use uma conta Instagram profissional. Para a primeira homologação de Stories, prepare uma conta Business e confirme no painel/documentação a elegibilidade para o fluxo escolhido; não prometa Stories para todo tipo de conta.
3. Configure Instagram Login e os papéis/contas de teste, aceitando os convites quando necessário.
4. Cadastre exatamente:
   `https://app.seu-dominio.com/api/social/meta/callback`
5. Use os IDs/secrets correspondentes à configuração Instagram Login e configure:

```dotenv
INSTAGRAM_APP_ID=<id-do-aplicativo-instagram-login>
INSTAGRAM_APP_SECRET=<secret-do-aplicativo-instagram-login>
INSTAGRAM_REDIRECT_URI=https://app.seu-dominio.com/api/social/meta/callback
INSTAGRAM_GRAPH_API_VERSION=v26.0
```

A versão acima é a configurada atualmente no projeto; confirme suporte no painel antes da homologação. Não atualize a versão sem testar os endpoints.

6. O código solicita `instagram_business_basic` e `instagram_business_content_publish`. Confira que estão disponíveis no produto selecionado; não substitua pelos escopos antigos de outro fluxo.
7. Reinicie e conecte em **Contas sociais → Instagram**. Crie posts selecionando explicitamente a conta.
8. Teste nesta ordem: foto JPG, Reel MP4, carrossel e Story de uma mídia. Nosso limite de carrossel é 2–10 arquivos. Stories não exibem a legenda do feed: textos visuais devem estar na mídia.
9. Verifique se a Meta consegue buscar a mídia pela URL HTTPS assinada. Login do navegador, bloqueio de robôs ou URL expirada podem impedir o processamento.
10. Para contas externas aos papéis de teste, prepare revisão/acesso avançado e verificação empresarial quando exigidos no painel.

[Documentação do fluxo Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/). A página da Meta retornou limite de acesso nesta consulta; etapas e escopos acima estão alinhados ao código local e devem ser conferidos no painel. A coleção oficial da Meta documenta diferenças do fluxo com Facebook Login e limitações de Stories, que não devem ser transferidas automaticamente entre fluxos. [Coleção oficial](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-ab559ffb-8e2c-4b0a-b43a-5737b6d2f672)

## 6. Facebook — Páginas

1. Prepare uma Página de teste e uma pessoa autorizada a criar conteúdo nela.
2. No Meta for Developers, configure o caso de uso de gerenciamento de Páginas e o login do aplicativo. As permissões solicitadas pelo código são `pages_show_list`, `pages_read_engagement` e `pages_manage_posts`.
3. Cadastre o callback exato `https://app.seu-dominio.com/api/social/facebook/callback`. O callback `/api/social/meta/callback` pertence ao Instagram Login.
4. Configure no servidor:

```dotenv
FACEBOOK_APP_ID=<id-do-app-meta>
FACEBOOK_APP_SECRET=<secret-do-app-meta>
FACEBOOK_REDIRECT_URI=https://app.seu-dominio.com/api/social/facebook/callback
FACEBOOK_GRAPH_API_VERSION=v26.0
```

5. Reinicie e use **Contas sociais → Facebook Páginas → Conectar**. Na autorização Meta, escolha as Páginas que deseja disponibilizar à equipe. O Arcsync armazena as Páginas concedidas com tarefa de criar conteúdo/gerenciar. Em cada post, selecione explicitamente a Página de destino.
6. Tokens de Página ficam criptografados. A validade da autorização do usuário não é usada como prazo do token da Página; o Facebook valida o token ao publicar. Se a Meta recusar a autorização, reconecte a Página. Não há refresh token de Facebook.
7. Teste texto e depois uma foto JPG/PNG. O agendamento ocorre na fila do Arcsync: o cron envia ao Facebook no horário escolhido. A primeira versão não fornece campo específico de prévia de link, vídeos ou múltiplas fotos.
8. Para atender clientes externos, conclua revisão, acessos e verificação empresarial pedidos pelo painel. Remover a Página do Arcsync remove a conexão local; para revogar o app na Meta, remova-o também nas integrações comerciais do Facebook.

[Referência de publicação em Páginas](https://developers.facebook.com/docs/pages-api/posts/). A leitura automatizada dessa referência retornou limite de acesso. Os endpoints e permissões implementados devem ser confirmados no painel e na homologação real; os testes locais usam respostas simuladas, não certificam compatibilidade externa.

## 7. Sequência do primeiro teste real

1. Conferir a preparação técnica e os requisitos de ambiente do roadmap.
2. Aplicar configuração no ambiente HTTPS de homologação e reiniciar o serviço.
3. Conectar uma conta por rede via OAuth; não copiar tokens temporários de exploradores de API para o banco.
4. Salvar rascunho e conferir conta, formato, texto, mídia, horário e fuso por destino.
5. Revisar todos os agendamentos vencidos; liberar `PUBLISHING_ENABLED=true` no app e agendador e recriar os serviços. Fazer primeiro envio individual, depois multiplataforma.
6. Conferir o conteúdo no aplicativo da rede e registrar ID/link/horário real.
7. Verificar histórico, retentativa parcial, reconexão e cron sem o navegador aberto.
8. Só liberar para clientes depois dos testes e aprovações aplicáveis.

## 8. Diagnóstico rápido

| Sintoma | Primeira checagem |
|---|---|
| Redirect URI inválida | Comparar protocolo, domínio e caminho completos no painel e variável |
| Conta conectada, sem publicar | `PUBLISHING_ENABLED=true`, conta do destino, permissões, formato e cron |
| Mídia não processada no Instagram | JPG/codec, URL HTTPS assinada acessível e expiração |
| YouTube desconecta após uma semana | Status Testing da configuração OAuth |
| TikTok só permite privado | Auditoria, privacidade da conta e opções do criador |
| Página Facebook não aparece | Permissões concedidas, Página selecionada na autorização e tarefa CREATE_CONTENT/MANAGE |
| Resultado incerto | Conferir a rede antes de qualquer reenvio; não apagar o estado para forçar nova tentativa |
| Posts param com navegador fechado | Confirmar cron e serviço do servidor em execução |

Resultado esperado: cada rede anuncia sucesso somente após o fluxo correspondente confirmar a publicação, e o usuário consegue distinguir falha, processamento e resultado incerto. Credenciais configuradas são uma etapa; a homologação real é outra.

## 9. Páginas públicas já disponíveis

Cadastre URLs do domínio real com estes caminhos: `/about`, `/privacy`, `/terms`, `/support`, `/data-deletion`. Preencha `LEGAL_OPERATOR_NAME` e `SUPPORT_EMAIL`; os valores são lidos em execução, após reiniciar o serviço. Os textos descrevem o funcionamento implementado e precisam de revisão do responsável, incluindo fornecedores, retenção e atendimento aos pedidos. A exclusão de dados é um pedido manual ao suporte; não há promessa de apagamento automático nem callback Meta de exclusão nesta versão. Não submeta dados fictícios à revisão.

Material de cadastro e roteiros de revisão: `APROVACAO-REDES.md`. Nome/contato preenchidos conforme informado; domínio de e-mail não define automaticamente o domínio HTTPS do app.

## 10. Ativação operacional na etapa final

A fila agora exige `PUBLISHING_ENABLED=true` no ambiente do app e do agendador. Manter `false` durante preparação/restauração. Mesmo com OAuth configurado, nenhuma publicação automática será iniciada enquanto essa liberação não ocorrer.

O perfil Compose `operations` fornece agendador e monitor; não manter um segundo cron concorrente sem necessidade. Instalação, alertas, backup e recuperação estão em `OPERACAO-MVP.md`. Configurar e ensaiar essas rotinas no host de homologação antes de liberar contas reais. Credenciais, HTTPS e submissões continuam reservados à etapa final.


## 11. Instalação Docker — parâmetros que faltavam no roteiro

No host Linux, usar Node 24 para ferramentas locais e Docker Compose para os serviços. O arquivo `compose.production.yaml` não cria o banco nem o proxy HTTPS: ambos devem ser provisionados separadamente.

Preparar um `.env` de interpolação do Compose, separado do arquivo de segredos da aplicação:

```dotenv
FEEDSYNC_IMAGE_TAG=homologacao
FEEDSYNC_ENV_FILE=/etc/arcsync/homologacao.env
FEEDSYNC_UPLOADS_HOST_DIR=/var/lib/arcsync/uploads
FEEDSYNC_PORT=3000
FEEDSYNC_UID=1000
FEEDSYNC_GID=1000
```

Os caminhos e a etiqueta são exemplos. Criar o diretório persistente com permissão de escrita para o UID/GID escolhido. Proteger o arquivo de segredos. `MONGODB_URI` precisa ser alcançável de dentro do container: `localhost` aponta para o próprio container, não para o banco do host. Configurar rede/autenticação do banco sem expor a porta publicamente.

Na etapa final, a partir da raiz do projeto e com esses arquivos preparados:

```sh
docker compose -f compose.production.yaml config --quiet
docker compose -f compose.production.yaml build app env-check
docker compose -f compose.production.yaml run --rm env-check
docker compose -f compose.production.yaml up -d app
```

O validador está na imagem `env-check` (estágio builder); a imagem enxuta do app não inclui todas as ferramentas de desenvolvimento. Não executar `check:env` diretamente no runner esperando a mesma estrutura do repositório. O validador exige SMTP e não testa permissões efetivas das redes.

A porta web é publicada somente em `127.0.0.1` do host. Configurar proxy reverso e certificado HTTPS, preservando Host e protocolo encaminhado. Ajustar limite de corpo/tempo de upload para suportar os 95 MB aceitos pelo app e a sobrecarga do formulário. Validar também entrega e expiração de mídias assinadas.

SMTP: preencher as cinco variáveis da seção 2 com dados reais do provedor. O código usa TLS direto na porta 465; para 587, usa o transporte SMTP com negociação de TLS conforme o servidor. Confirmar remetente autorizado e autenticação do domínio com o provedor. Testar recuperação de senha e recebimento na etapa final.

Depois de validar contas, revisar a fila e liberar os testes reais, definir `PUBLISHING_ENABLED=true` no arquivo da aplicação e executar:

```sh
docker compose -f compose.production.yaml --profile operations up -d --force-recreate app scheduler monitor
```

A fila pode executar imediatamente. Não fazer essa liberação com posts vencidos ainda não revisados. Alertas e backups seguem `OPERACAO-MVP.md`; backups exigem chave própria, distinta das chaves dos tokens e URLs. Nenhum desses comandos foi executado contra um servidor nesta revisão.

## 12. Conferência das fontes em 03/11/2026

- Google: conferidas [referência de upload](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert) e [OAuth](https://developers.google.com/identity/protocols/oauth2). Mantidos os dois escopos do código e envio privado por padrão do Arcsync; isso é diferente do padrão da API.
- TikTok: conferidas [diretrizes de compartilhamento](https://developers.tiktok.com/docs/en/content-sharing-guidelines) e [transferência de mídia](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide). Mantidas auditoria, restrições não auditadas e verificação de propriedade para PULL_FROM_URL.
- Meta: referências de Instagram Login e Facebook Pages retornaram HTTP 429. Callbacks, escopos e versão v26.0 foram comparados com o código; disponibilidade, acessos e elegibilidade devem ser confirmados no painel. Não considerar essa parte uma validação externa concluída.

## 13. Navegação e marca para a revisão

A home autenticada está em `/`; o calendário está em `/calendar`. Para apresentação pública e revisores sem sessão, usar `/about`, além das páginas legais. Logos oficiais e modos claro/escuro já estão integrados; os arquivos com sufixo `-dark` têm texto escuro e são usados no tema claro. A preferência de tema é local ao navegador. Não muda callbacks ou configurações das redes.
