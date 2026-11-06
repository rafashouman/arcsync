# Retenção e exclusão — proposta para revisão da NexuSync

Escolha do responsável em 02/11/2026: preparar histórico de 180 dias e backups de 30 dias. **Proposta não ativada como exclusão automática e não apresentada ao público como compromisso já implementado.**

Responsável informado: NexuSync. Canal: contato@nexusync.online. Prazos e exceções devem ser revisados conforme a operação, contratos e necessidades aplicáveis; não são apresentados como exigência legal.

## Proposta operacional

| Categoria | Proposta | Situação atual |
|---|---|---|
| Histórico de posts finalizados/excluídos | 180 dias a contar da finalização ou exclusão, usando a data mais recente | Preservado no banco; não há expurgo automático |
| Rascunhos e posts ativos | Preservar enquanto necessários à conta/equipe; revisar inatividade separadamente | Sem prazo automático definido |
| Resultados incertos | Reconciliar antes de qualquer remoção, mesmo ultrapassando o prazo | Reenvio bloqueado |
| Mídias | Remover apenas quando não referenciadas por posts preservados ou em andamento | Não remover apenas com base na idade do arquivo |
| Backups criptografados | Cópias diárias; retenção de 30 dias após criação | Rotina preparada, ainda não ativada |
| Diário técnico do agendador | Sete dias; apenas datas, resultado e contagem | TTL implementado; distinto do histórico do post |
| Tokens sociais | Remover conexão quando desconectada; revogação na rede conforme provedor | Não prometer que excluir localmente revoga toda autorização externa |

Antes de ativar expurgo: aprovar a política, implementar modo de relatório, validar referências de mídias e exclusão por equipe, revisar exceções e testar recuperação. Não apagar backups antigos até existir uma cópia recente restaurada com sucesso. A expiração de backups deve incluir cópias remotas e respeitar registros de exclusão pendentes.

## Atendimento de exclusão

1. Receber pedido pelo contato público. Registrar protocolo, data, escopo e retorno, sem pedir senha ou token.
2. Verificar titularidade e papel no workspace; distinguir dados individuais de conteúdo compartilhado e ativos de outros integrantes.
3. Levantar conexões, posts, histórico, mídias, sessões, convites e cópias de segurança envolvidos. Suspender agendamentos abrangidos antes de qualquer execução de exclusão aprovada.
4. Definir eventuais exceções e informar o alcance ao solicitante. Não inventar prazo de resposta automático: a NexuSync deve estabelecer e acompanhar esse prazo antes da abertura pública.
5. Executar procedimento validado e restrito ao escopo confirmado; registrar conclusão sem conservar os próprios dados removidos no protocolo.
6. Quando houver restauração de backup, reaplicar pedidos de exclusão posteriores à data da cópia antes de reabrir o ambiente. Preservar um registro mínimo protegido desses pedidos para esse fim.
7. Explicar que posts já publicados nas redes e os dados mantidos por elas têm procedimento separado. Não afirmar que apagar no Arcsync remove o conteúdo externo.

## Inventário de fornecedores a concluir antes da abertura

O repositório contém configuração para VPS Hostinger, MongoDB, armazenamento de mídia local e SMTP, além das APIs de Meta, Google e TikTok. Isso não confirma quais provedores/regiões/contratos estão ativos. Na etapa do ambiente, registrar fornecedor real, finalidade, região e responsável de hospedagem, banco, SMTP, backup remoto e alertas. Atualizar a política pública com informações verificadas.

## Aprovação interna pendente

- [ ] NexuSync revisou prazo inicial, exceções e contagem dos 180/30 dias.
- [ ] Procedimento de atendimento tem responsável e prazo definidos.
- [ ] Fornecedores e regiões reais foram registrados.
- [x] Prévia somente de leitura para posts foi implementada e testada entre equipes; não há comando de expurgo. Mídias ainda exigem análise própria de referências.
- [ ] Backups foram restaurados e pedidos de exclusão podem ser reaplicados.
- [ ] Texto público foi alinhado ao procedimento aprovado antes da ativação.

## Prévia operacional, sem exclusão

Com `MONGODB_URI` já disponível no ambiente, executar:

```sh
npm run retention:report -- --workspace ID_EXATO_DA_EQUIPE
npm run retention:report -- --workspace ID_EXATO_DA_EQUIPE --backup-dir /diretorio/de/backups
```

O script não carrega `.env.local` automaticamente: fornecer a variável pelo ambiente protegido do operador. Preferir usuário Mongo com acesso somente de leitura. A saída JSON é uma simulação para revisão interna; não é autorização para apagar e não contém opção de aplicação. Não inserir URI ou senha nos argumentos. Uma falha encerra o comando sem imprimir detalhes de conexão.

Posts: a consulta usa exclusivamente o workspace informado, incluindo excluídos da agenda. Mostra contagens, motivos de preservação e IDs/datas dos candidatos. Não mostra legendas, URLs de mídias ou sessões de upload. Registros legados sem workspace não entram no relatório e exigem revisão separada. Guardar qualquer relatório exportado com acesso restrito.

Como não há data própria de finalização no modelo atual, a referência conservadora é a mais recente entre atualização, exclusão e histórico. Isso pode adiar a revisão. Datas ausentes/inválidas/futuras, posts ativos, falhas ainda não revisadas, reservas de processamento e resultados incertos são preservados. Publicados sem confirmação coerente nos estados das redes também são preservados.

Backups: a pasta opcional é escopo do operador e pode conter cópias de todas as equipes; não é filtrada pelo workspace. A prévia inspeciona somente nomes e datas de arquivos `.fsbk`, sem abrir/descriptografar. Usa a data mais recente entre o nome padronizado e a modificação; preserva a cópia local de modificação mais recente mesmo quando antiga. Nomes desconhecidos, datas inválidas e links são preservados. A indicação de 30 dias exige confirmação posterior de integridade, restauração, cópia externa e aprovação da política; a ferramenta não comprova essas condições.

Mídias não são candidatas à remoção nesta prévia. Excluir um registro não autoriza apagar seu arquivo: referências de outros posts, destinos e equipes ainda precisam ser verificadas antes de implementar qualquer expurgo.

## Referências de mídias compartilhadas — prévia adicional

`npm run retention:report -- --workspace ID_EXATO_DA_EQUIPE --media-references` acrescenta uma varredura global somente de leitura. Exige acesso de operador a todos os posts, incluindo legados, excluídos e outras equipes. Executar fora dos períodos de maior uso: são feitas consultas adicionais sobre a coleção completa.

A saída apresenta identificadores hash dos caminhos locais usados pelos posts candidatos e quantos posts candidatos/protegidos referenciam cada mídia, considerando a mídia comum e a mídia própria de cada destino. Não apresenta URLs, IDs nem nomes de outras equipes. Referências externas, assinadas ou fora do formato reconhecido são contadas como não resolvidas e exigem revisão manual. Nenhum arquivo é autorizado para remoção, mesmo quando não há outra referência reconhecida.

Limites: não inventaria arquivos órfãos no disco nem outros locais de armazenamento; a leitura não é um snapshot transacional e pode haver alterações durante a varredura. Antes de uma futura exclusão será necessário revalidar referências com os escritores suspensos ou mecanismo equivalente. A política continua uma proposta.
