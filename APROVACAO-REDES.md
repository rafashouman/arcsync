# Dossiê de configuração e revisão das redes

> Estado consolidado em 03/11/2026: consultar `PENDENCIAS-FINAIS-MVP.md` para o trabalho restante e `GUIA-CONFIGURACAO-REDES.md` para instalação/configuração revisada. Home em `/`, calendário em `/calendar`, temas e logos oficiais concluídos. Registros de testes abaixo são históricos; não comprovam homologação externa.

Preparado em 02/11/2026. Status: material preparado; nenhum cadastro, consentimento, envio de formulário ou aprovação externa realizado.

## Identidade informada

Responsável informado: **NexuSync**. Contato público: **contato@nexusync.online**.
Produto identificado atualmente na interface: **Arcsync**. O nome do responsável não foi tratado como pedido de renomear o produto. Use essa distinção consistentemente nos cadastros; caso o nome comercial do produto mude, alinhe interface e formulários antes da submissão.

Esses dados foram preenchidos em `.env.local` e no exemplo de configuração, exclusivamente nos campos `LEGAL_OPERATOR_NAME` e `SUPPORT_EMAIL`. Não foram cadastrados CNPJ, endereço, natureza jurídica ou pessoa física, pois não foram informados. Forneça documentos apenas no painel oficial se solicitados. A existência/recebimento da caixa de e-mail não foi testada.

## Descrição para o cadastro

O Arcsync é uma aplicação web de planejamento e publicação de conteúdo original para criadores e equipes. O usuário conecta contas que está autorizado a gerenciar, escolhe a conta de destino, prepara mídia e texto, revisa as opções específicas de cada rede e define o horário do envio. O calendário, o histórico e o monitoramento mostram o resultado de cada destino. O produto oferece papéis de equipe e aprovação de conteúdo. Nenhuma publicação é iniciada apenas ao conectar uma conta.

## Endereços a cadastrar na etapa final

Acrescentar os caminhos abaixo à origem HTTPS definitiva. O domínio do e-mail não foi assumido como domínio do app.

| Uso | Caminho |
|---|---|
| Apresentação pública | `/about` |
| Privacidade | `/privacy` |
| Termos | `/terms-service` |
| Contato | `/support` |
| Instruções de exclusão | `/data-deletion` |
| Retorno Google/YouTube | `/api/social/youtube/callback` |
| Retorno TikTok | `/api/social/tiktok/callback` |
| Retorno Instagram Login | `/api/social/meta/callback` |
| Retorno Facebook Pages | `/api/social/facebook/callback` |
| Prefixo de mídia a verificar no TikTok | `/api/media/` |

Não cadastrar `localhost` como página pública de revisão. Não usar o retorno do Instagram como retorno do Facebook. A página de exclusão contém instruções de atendimento manual; não é um endpoint de exclusão automática ou desautorização.

## YouTube / Google

Produto: YouTube Data API v3, cliente OAuth de aplicação web.

| Permissão solicitada pelo código | Justificativa para o revisor |
|---|---|
| `https://www.googleapis.com/auth/youtube.upload` | Enviar os vídeos que o usuário selecionou e autorizou, incluindo título, descrição, visibilidade e declarações de conteúdo. |
| `https://www.googleapis.com/auth/youtube.readonly` | Identificar o canal conectado e consultar informações/métricas apresentadas na aplicação. |

Roteiro a gravar na etapa final: abrir a apresentação pública e a política; conectar o canal pelo consentimento Google mostrando todos os escopos; selecionar o canal no editor; preencher metadados e escolher privado; publicar um vídeo de teste; mostrar o resultado no canal e no histórico; demonstrar como desconectar e revogar o acesso.

Preparar a comprovação de propriedade do domínio, informações consistentes de marca e o vídeo que mostre o uso de cada escopo. A necessidade/modalidade de verificação é determinada pelo Google e pelo público do app. Não declarar que o vídeo foi gravado ou que os escopos foram aprovados. [Orientação oficial de verificação](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

## TikTok

Produtos: Login Kit e Content Posting API, Direct Post.

| Escopo | Justificativa |
|---|---|
| `user.info.basic` | Identificar a conta conectada para o usuário conferir o destino. |
| `video.publish` | Publicar o vídeo original após a revisão e o consentimento explícito. |

Roteiro: conectar a conta; mostrar nome do criador; selecionar privacidade e interações; revisar a prévia, duração e texto; demonstrar divulgação comercial, rótulos e links dos termos; consentir; enviar; acompanhar o resultado. Gravar o fluxo real somente na etapa final.

Novos envios usam `PULL_FROM_URL`; verificar a propriedade do domínio/prefixo da mídia no painel. Manter `TIKTOK_CLIENT_AUDITED=false` até aprovação efetiva. Clientes não auditados estão limitados a contas privadas, `SELF_ONLY` e até cinco usuários por 24 horas. O produto deve atender uma audiência de criadores; não apresentá-lo como ferramenta exclusivamente interna de uma equipe. [Diretrizes oficiais](https://developers.tiktok.com/docs/en/content-sharing-guidelines).

## Instagram / Meta

Fluxo implementado: Instagram API with Instagram Login.

| Permissão | Justificativa |
|---|---|
| `instagram_business_basic` | Identificar a conta profissional conectada para seleção do destino. |
| `instagram_business_content_publish` | Publicar fotos, Reels, carrosséis e Stories preparados e autorizados pelo usuário, conforme elegibilidade da conta. |

Roteiro: conectar conta profissional; mostrar seleção do destino e dos formatos; enviar uma foto JPG; demonstrar Reel, carrossel e Story apenas se habilitados para a conta; mostrar resultado e histórico. Para Story, o texto deve estar na mídia, não na legenda do feed.

Confirmar no painel os papéis, contas de teste, acesso avançado e eventual verificação empresarial exigidos. [Referência oficial do fluxo](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/).

## Facebook / Meta

Recorte: Páginas, texto ou uma foto JPG/PNG no feed e vídeos MP4. Sem publicação em perfil pessoal ou grupo; sem Stories/Reels/carrossel nesta versão.

| Permissão | Justificativa |
|---|---|
| `pages_show_list` | Listar as Páginas autorizadas para permitir selecionar o destino. |
| `pages_read_engagement` | Acesso de leitura da Página exigido no fluxo de gerenciamento/publicação; demonstrar o uso efetivo e confirmar exigência no painel antes de submeter. |
| `pages_manage_posts` | Criar o post autorizado na Página selecionada. |

Roteiro: autorizar Páginas no login Meta; mostrar as Páginas conectadas; selecionar uma no editor; publicar texto, foto e vídeo MP4 de teste; mostrar conteúdo na Página e histórico do app; explicar a desconexão local e a revogação nas integrações comerciais do Facebook.

[Referência oficial de publicação](https://developers.facebook.com/docs/pages-api/posts/) e [App Review](https://developers.facebook.com/docs/app-review/). A consulta automatizada à documentação Meta não esteve disponível. A lista reflete o código; requisitos atuais, endpoints e evidências devem ser conferidos no painel na etapa final.

## Controle de conclusão

| Item | Situação |
|---|---|
| Nome e contato públicos | Preenchidos com os dados informados |
| Descrição, permissões e roteiros | Preparados neste documento |
| Páginas públicas locais | Implementadas; conteúdo operacional precisa refletir o serviço efetivamente oferecido |
| Retenção, fornecedores e atendimento de exclusão | Definir com o responsável antes de enviar políticas aos revisores; pedidos de exclusão são manuais e não há prazo automático implementado |
| Domínio HTTPS e comprovação de propriedade | Adiados por instrução do usuário |
| Credenciais, usuários/canais de teste e acesso do revisor | Etapa final; não incluir senhas neste documento |
| Gravações com conexão/publicação real | Etapa final |
| Submissões e decisões das plataformas | Não realizadas; não equivalem à aprovação dos testes locais |

Quando houver ambiente e credenciais, executar o roteiro do `GUIA-CONFIGURACAO-REDES.md`, gravar evidências reais e só então submeter. Nunca usar simulações locais como prova de uma publicação real.
