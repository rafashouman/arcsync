# Preparação e homologação do MVP

## Implementado nesta etapa
- Conta de destino persistida e consultada no envio; troca de padrão não redireciona posts.
- Validação de pertencimento da conta ao workspace ao salvar.
- Instagram: feed JPG, carrossel de 2–10 mídias, Reel e Story de uma mídia.
- TikTok e YouTube: vídeo. Não há promessa de Stories/carrosséis nessas redes.
- Texto específico por rede, com fallback para legenda principal.
- Publicar agora coloca o conteúdo na fila (janela inicial de 30 segundos, sujeita ao cron e aprovação).
- Resultado por rede, aviso de resultado incerto e link de vídeos do YouTube.
- Cron com até três reservas simultâneas, doze etapas por chamada e interrupção de novos lotes após 35 segundos. Isso não limita a duração de uma chamada externa já iniciada.
- Posts legados sem destino explícito são bloqueados. Revisar e salvar cada agendamento; não migrar automaticamente para a conta padrão atual.

## Etapa A — sem credenciais sociais
1. Executar `npm test`, `npm run lint`, `npx tsc --noEmit` e `npm run build`.
2. Com MongoDB de teste, criar dois workspaces e usuários com papéis distintos.
3. Criar rascunhos com cada formato, fechar e reabrir; confirmar conta, formato e texto persistidos.
4. Confirmar que ausência de conta permite rascunho e impede agendamento.
5. Validar cardinalidade: Story/feed/Reel com uma mídia, carrossel com 2–10.
6. Conferir visualmente o editor em desktop e celular.

## Ainda pendente antes de declarar todo o plano concluído
- Mídias e horários independentes por destino: implementados; conferir a atualização abaixo.
- Título e descrição do YouTube em campos separados (atualmente primeira linha e restante do texto).
- Auditoria permanente de exclusões e resolução operacional de resultados incertos.
- Cancelamento explícito com histórico (hoje excluir ou voltar a rascunho antes do processamento).
- Alertas e monitoramento de atraso, backup e teste de restauração.
- Testes de integração com banco/concorrência e navegador; testes de carga e reinício durante envio.
- Homologação real de cada formato; a presença do código não certifica permissões das plataformas.

## Etapa B — credenciais por último
Somente após a preparação local: configurar ambiente HTTPS de homologação, armazenamento persistente, MongoDB isolado, chaves de criptografia/assinatura de mídia, segredo de cron e IDs/secrets/callbacks dos aplicativos sociais conforme `.env.example`. Conectar contas pelo OAuth, sem inserir tokens manualmente no código. Nunca versionar segredos.

Validar Instagram feed/Reel/carrossel/Story; TikTok vídeo com consentimento e privacidade; YouTube vídeo. Confirmar elegibilidade da conta para Stories. TikTok público depende de auditoria. Shorts são classificados pelo YouTube, não por um parâmetro do upload.

Agendar vários posts no mesmo minuto; trocar conta padrão após agendar; remover uma conta antes do envio; expirar token; causar falha em uma rede; interromper o serviço durante upload. Em cada cenário, registrar destino, horário solicitado, início do envio, resultado por rede e ausência de duplicação. Não disparar publicações reais nos testes automatizados.

Meta proposta: iniciar 95% dos envios em até dois minutos sob carga definida; ainda não medida. Atrasos da plataforma devem ser medidos separadamente.

## Atualização — destinos independentes e testes
Horários e mídias agora podem ser definidos por destino. A fila escolhe destinos vencidos e espera pelo próximo horário; destinos concluídos são preservados. Alterações por arraste ficam bloqueadas quando há horários próprios: usar o editor.

Histórico persistido de criação, edição, reserva, progresso, espera, retentativa, aprovação/rejeição e resultado de plataforma. O histórico não captura tokens/URLs de upload. Limitação: exclusão física do post também remove seu histórico; ainda não é uma auditoria permanente de exclusões.

Monitoramento em `/monitoring`, restrito ao workspace da sessão: falhas, resultados incertos e atrasos de mais de dois minutos. É uma consulta manual; não envia notificações externas e não detecta sozinha a ausência de chamadas do cron.

Testes executados: 48 testes automatizados, tipos e lint; integração com MongoDB descartável na porta 27119 (persistência, isolamento, duas reservas concorrentes, reserva inválida, horários independentes e histórico). `npm run test:integration` exige esse MongoDB de teste e usa exclusivamente `feedsync_mvp_integration`.

Navegador: login com conta fictícia em `feedsync_mvp_browser`, criação e reabertura de rascunho com horários/textos diferentes, presença do histórico e abertura do monitoramento. Upload por destino, visualização móvel, falha real de plataforma e reinício durante upload ainda não foram homologados no navegador.

## Conclusão da etapa seguinte
- Exclusão lógica implementada: posts saem da agenda/fila e ficam no histórico de excluídos do monitoramento (100 mais recentes na interface). Registros continuam no banco sem descarte automático.
- Monitoramento atualiza a cada 30 segundos com página visível, além do botão manual.
- Navegador: upload de PNG fictício apenas no Instagram, salvamento/reabertura com mídia persistida, prévia do destino, exclusão de rascunho e confirmação de auditoria na tela de monitoramento. PNG pode ser guardado como rascunho, mas a validação exige JPG no envio ao Instagram.
- Integração ampliada: exclusão preserva histórico, remove da consulta ativa e respeita isolamento entre workspaces.
- Build Docker/Linux com a imagem `feedsync:mvp-check` aprovado. Falha nativa do Turbopack no Windows permanece específica desse ambiente; usar o Dockerfile existente para build de produção. Nenhum deploy foi realizado.
- Pendentes da homologação externa: credenciais, permissões e publicação real em cada rede/formato, carga e reinício durante upload real. Notificações externas e backup/restauração de produção continuam fora desta etapa local.

Correção adicional verificada: a rota de mídia agora autoriza o workspace ativo além do proprietário legado. A imagem fictícia foi aberta no navegador como PNG 1×1 após a correção (antes retornava 404).


## Preparação adicional — 2 de novembro de 2026

- YouTube: campos próprios persistidos de título, descrição, visibilidade e declarações; padrão privado.
- TikTok: novos envios por PULL_FROM_URL, URL assinada por 48h e intenção persistida antes de iniciar. Sem confirmação de início, não repete automaticamente. Consulta com publish_id reaproveita a sessão mesmo se a mídia/configuração mudar. A cota não auditada considera a conta TikTok, não o usuário do FeedSync.
- Facebook: OAuth, permissões/tarefas de Página, tokens criptografados, escolha por destino, texto ou foto JPG/PNG, integração à fila e proteção de resultado incerto. Não há Reels/Stories/carrossel Facebook nesta entrega.
- Páginas públicas: apresentação, privacidade, condições, suporte e solicitação manual de exclusão. Dados reais do responsável/contato ficam para a configuração final.
- 54 testes automatizados passaram. Integração original passou no banco isolado.
- `npm run test:providers`: simula OAuth Facebook com filtro de tarefa e recusa sem permissões; testa persistência/execução Facebook e TikTok URL → consulta → resultado; impede retry de resultado incerto. Nenhuma chamada externa real.
- TypeScript e lint passaram; imagem `feedsync:mvp-check` compilada em Docker/Linux. A limitação do build nativo Windows/Turbopack continua separada.
- Navegador: rascunho Facebook/YouTube salvo e reaberto preservando texto próprio, título/descrição e visibilidade não listado; conferidas páginas públicas e seção Facebook em Contas sociais. Evidência: `tests/fixtures/provider-options-verified.png`. Banco fictício `feedsync_mvp_browser`, não produção.
- Configuração e publicação real, revisão dos textos públicos, deploy HTTPS, verificação de domínio e aprovações das redes não foram executados. Facebook usa endpoints ainda sujeitos à confirmação na homologação; a consulta automatizada da documentação Meta foi limitada.
- O npm reportou 16 alertas moderados ao instalar a árvore de dependências do build. Não foi aplicado `audit fix --force`; a avaliação de alcance e atualização de dependências permanece no checklist antes da abertura pública.

## Identidade, dependências e revisão das redes — 02/11/2026

- Responsável NexuSync e contato contato@nexusync.online preenchidos sem alterar outras variáveis locais. As cinco páginas públicas responderam HTTP 200 com esses dados e link mailto correto.
- Next/React/Tailwind e tipos Node atualizados conforme `REVISAO-DEPENDENCIAS.md`; lockfile atualizado e tipos redundantes de Mongoose removidos.
- Auditoria após atualização: zero alertas de produção; 16 moderados de desenvolvimento ainda abertos.
- TikTok: links de confirmação de música e política de marca; rótulo comercial; impedimento de visibilidade privada para conteúdo patrocinado; botão de agendamento bloqueado se a divulgação comercial estiver incompleta.
- Verificações aprovadas após atualização: 54 testes, TypeScript, lint, integração de persistência, integração simulada de provedores e build Docker/Linux (Next 16.4.4).
- Dossiê `APROVACAO-REDES.md` preparado. Nenhuma submissão, aprovação externa, conexão real, teste de e-mail ou publicação executada. HTTPS e credenciais permanecem para a etapa final.

## Operação e recuperação — atualização de 02/11/2026

Esta atualização substitui as pendências operacionais das seções anteriores. Procedimentos em `OPERACAO-MVP.md`; retenção em `POLITICA-RETENCAO-PROPOSTA.md`.

- 59 testes automatizados passaram, assim como TypeScript e lint.
- Integração operacional: 32 reservas concorrentes para 24 posts sem duplicidade; reconexão ao banco e reserva expirada; trabalhador antigo bloqueado; envio incerto preservado sem chamada ao provedor.
- Backup: documento e índice Mongo, mídia e configuração fictícia restaurados de arquivo criptografado em container isolado. Chave incorreta e adulteração recusadas. Os scripts Linux passaram na verificação de sintaxe; parada/reinício completo no host ainda precisa ser ensaiado na instalação.
- Monitoramento: sinal periódico persistido, detecção de ausência/travamento e serviço opcional de alertas por mudança/recuperação. Nenhum webhook externo foi configurado ou acionado.
- Publicação automática bloqueada por padrão com `PUBLISHING_ENABLED=false`; liberação explícita somente na homologação.
- Navegador móvel (390 × 844): editor sem transbordamento horizontal; Tab/Shift+Tab permanecem no diálogo, Escape fecha e devolve foco ao botão Novo post. Essa checagem não representa auditoria completa de acessibilidade.
- Retenção de histórico por 180 dias e backups por 30 dias preparada como proposta, sujeita à revisão da NexuSync. Expurgo automático de conteúdo e backups não ativado.
- Permanecem finais: HTTPS, credenciais, instalação das rotinas, teste do alerta/SMTP, submissões e homologação real. Carga local não mede desempenho das APIs reais.
- Verificação final: configuração Compose validada e imagem Docker/Linux `feedsync:mvp-check` compilada com sucesso incluindo as rotinas operacionais. Nenhum deploy realizado. Evidência móvel: `tests/fixtures/operations-mobile-verified.png`.

## Prévia de retenção — 02/11/2026

- Relatório de leitura implementado para a proposta 180/30 dias; não há comando de exclusão. Uso e limitações em `POLITICA-RETENCAO-PROPOSTA.md`.
- 63 testes automatizados passaram, além de TypeScript e lint. Novos cenários cobrem limites de prazo, datas inválidas, exclusão recente, atividade recente, resultado incerto e preservação de envios em andamento.
- `npm run test:retention` passou com Mongo local dedicado `feedsync_mvp_retention`: somente a equipe solicitada aparece, conteúdos privados são omitidos, documentos permanecem idênticos e a cópia de backup local mais recente é preservada na prévia. O teste remove apenas seus próprios dados fictícios ao encerrar.
- A pasta de backups é escopo do operador, independente da equipe escolhida. Não foram inspecionados backups reais. Mídias compartilhadas e execução de expurgo permanecem fora desta ferramenta de relatório.

## Referências compartilhadas e reconferência — 02/11/2026

- 65 testes automatizados passaram. Integração de retenção passou com uma mídia comum de um candidato também usada por destino de outra equipe: contabilizada como protegida, sem expor caminho ou dados externos e sem modificar documentos.
- Relatório global opcional `--media-references` preparado. Não inventaria órfãos nem autoriza apagar arquivos; referências desconhecidas ficam pendentes de revisão.
- Ensaio de backup criptografado/restauração repetido e aprovado com dados fictícios em Mongo isolado. Isso não substitui o ensaio completo dos serviços no host final.
- Auditoria repetida: produção zero alertas; desenvolvimento mantém 16 moderados. Não foi encontrada correção completa apenas migrando o ESLint mais recente.

## Home e aparência — 02/11/2026

- `/` agora é a home autenticada, com resumo do workspace e atalhos. Calendário preservado em `/calendar`, com link de retorno ao início. Alterações de posts/equipe revalidam as duas páginas.
- Seleção de modo claro/escuro disponível globalmente; escuro é o padrão. Preferência salva no navegador quando o armazenamento está disponível e aplicada antes da exibição inicial.
- TypeScript e lint aprovados. Navegador: home escura/clara, navegação ao calendário, editor claro, persistência após recarga e home móvel 390×844 sem transbordamento horizontal.
- Evidências: `tests/fixtures/home-light-verified.png` e `tests/fixtures/home-mobile-verified.png`. Nenhuma publicação real ou mudança de credencial.
