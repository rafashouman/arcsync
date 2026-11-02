# FeedSync — roadmap para publicações reais

Referência: 2 de novembro de 2026. Estado verificado no código local; contas e ambientes externos não foram auditados nesta etapa.

## Preparação técnica realizada

| Rede | Implementado | Etapa externa pendente |
|---|---|---|
| Instagram | OAuth; feed JPG, Reel, carrossel e Story; destinos fixos | Configuração Meta, elegibilidade e teste real de cada formato |
| YouTube | Upload resumível; título/descrição; privado/não listado/público; declarações de conteúdo | OAuth e teste real; conferir visibilidade na rede |
| TikTok | PULL_FROM_URL para novos envios; assinatura de mídia; consentimento; duração por destino; consulta de estado | Verificar domínio/prefixo, configurar app, auditoria e testes reais |
| Facebook Pages | OAuth e Páginas autorizadas; seleção por destino; texto ou uma foto; resultado incerto protegido | Conferir requisitos no painel Meta e homologar os endpoints reais |

Também disponíveis: horários/mídias próprios, histórico, monitoramento, aprovação e páginas `/about`, `/privacy`, `/terms`, `/support`, `/data-deletion`. Nenhum token real foi inserido e nenhuma publicação externa foi feita.

## Ordem restante

### 1. Revisão final de conteúdo e escopo
- Nome e contato preenchidos: NexuSync / contato@nexusync.online. Revisar textos públicos e definir retenção/atendimento de exclusão.
- Revisão de dependências realizada: zero alertas na árvore de produção; 16 moderados na cadeia de desenvolvimento ainda acompanhados em `REVISAO-DEPENDENCIAS.md`.
- Justificativas, callbacks e roteiros para os revisores preparados em `APROVACAO-REDES.md`; submissões externas ainda não realizadas.
- Facebook limitado ao feed de Página com texto ou uma foto. Outros formatos ficam para depois do MVP.
- Validar a experiência completa exigida pelos revisores das redes. Testes simulados não substituem essa aprovação.

### 2. Verificações locais
- `npm test`: regras e contratos simulados de API.
- `npm run test:integration`: persistência, isolamento, reservas simultâneas e histórico.
- `npm run test:providers`: OAuth Facebook simulado, fila Facebook, PULL_FROM_URL e proteção de resultado incerto do TikTok.
- TypeScript, lint, imagem Docker e verificação manual no navegador.
- Banco dos testes de integração: `127.0.0.1:27119/feedsync_mvp_integration`, separado do banco da aplicação.

### 3. Preparar ambiente HTTPS de homologação — configuração conjunta
- Deploy da imagem Docker, MongoDB isolado, armazenamento persistente de mídias e segredos no servidor.
- Domínio estável com HTTPS, callbacks exatos, saída de rede liberada para APIs e URLs de mídia acessíveis aos provedores.
- Cron autenticado a cada minuto; monitorar execuções, falhas e ausência de chamadas. A tela atual atualiza alertas enquanto aberta, mas não substitui um monitor externo do processo.
- Backup de banco, mídias e chaves; demonstrar restauração em outro ambiente.

**Concluído quando:** o app sobrevive a reinício, mantém arquivos, executa a fila sem navegador aberto e restaura um backup de teste.

### 4. Cadastrar aplicativos e conectar contas de teste — você + nossa configuração
Siga `GUIA-CONFIGURACAO-REDES.md`. Você controla os cadastros, identidades de empresa, contas e permissões. IDs e secrets entram apenas no servidor; os tokens das contas são obtidos pelo fluxo Conectar.

Podemos iniciar cadastros e preparar material de revisão em paralelo às etapas 1–3. A inserção das credenciais e a conexão das contas ficam após a preparação técnica, como combinado.

### 5. Homologar ponta a ponta — execução conjunta
1. Um post por rede e formato, com conteúdo de teste e conta destinada a testes.
2. Um conteúdo em várias redes com mídias e horários diferentes.
3. Trocar conta padrão depois de agendar: destino original deve permanecer.
4. Expirar/revogar autorização, desconectar conta e simular limite de API.
5. Falha em apenas uma rede; retentativa preserva sucessos.
6. Reinício durante envio e resultado incerto sem reenvio cego.
7. Vários posts no mesmo minuto; medir atraso por destino e concorrência.
8. Aprovação pendente/rejeitada, exclusão com auditoria e acesso entre equipes.
9. Conferir no próprio canal se o conteúdo realmente ficou visível; sucesso de upload não garante visibilidade pública.

**Concluído quando:** há evidência registrada por cenário e nenhum defeito crítico. Meta proposta de início de envio em até dois minutos deve ser medida sob carga acordada; não é uma garantia já atingida.

### 6. Revisões externas e piloto
- Submeter verificação OAuth do Google conforme os escopos e a audiência.
- Submeter acessos/revisões exigidos pela Meta para atender contas externas.
- Submeter auditoria TikTok, com fluxo de usuário e produto acessíveis ao revisor.
- Piloto com poucas equipes, alertas acompanhados e plano de reversão.

**Concluído quando:** cada rede liberada tem acesso aprovado para a audiência real e estabilidade comprovada. Prazos de análise pertencem às plataformas; não fixar data de lançamento com base em aprovação presumida.

## Depois do MVP
Biblioteca de mídia, templates, recorrência, melhores horários, relatórios avançados, notificações externas, cobrança e novas redes. Não ampliar esse escopo antes de concluir a publicação confiável.

## Preparação operacional concluída localmente — 02/11/2026

Agendador e monitor opcionais no perfil `operations`, sinal periódico de execução, bloqueio padrão da publicação, backup criptografado e roteiro de recuperação preparados. Integrações locais verificam concorrência, reconexão, resultado incerto e restauração. Consulte `OPERACAO-MVP.md` para instalação e limites verificados.

Na etapa de ambiente, instalar e ensaiar as rotinas no host, configurar destino de alertas e cópia externa de backup. A proposta de retenção 180/30 dias está em `POLITICA-RETENCAO-PROPOSTA.md`, pendente de revisão da NexuSync e sem expurgo automático. Esses passos não equivalem a deploy ou homologação externa.
