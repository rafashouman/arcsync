# Pendências finais do MVP — NexuSync

Atualizado em 03/11/2026. Este documento distingue preparação local de ativação operacional; nenhum teste simulado comprova aprovação ou publicação real.

| Frente | Preparação disponível | Condição ainda necessária |
|---|---|---|
| Interface | Home própria, calendário em `/calendar`, temas claro/escuro e logos oficiais | Revisão final da experiência completa com contas conectadas |
| Publicação | Destinos independentes, histórico, formatos do MVP, proteção de resultado incerto | Homologação de cada rede/formato, cotas e visibilidade real |
| Operação | Agendador, monitor, bloqueio de envio por padrão, alertas opcionais | Instalar no host; testar interrupção, alerta, SMTP e reinício |
| Recuperação | Backup criptografado, restauração isolada com dados fictícios | Ensaiar parada/reinício completos; cópia externa; definir e medir tempo de recuperação e perda tolerável |
| Privacidade | Contato público e proposta de retenção 180/30; relatório e referências compartilhadas | NexuSync aprovar política, responsável/prazo de atendimento e fornecedores reais |
| Exclusão | Remoção da agenda preserva auditoria; relatórios não apagam dados | Implementar expurgo após revisão, checar referências novamente e reaplicar exclusões após recuperação |
| Dependências | Auditoria de produção sem alertas reportados | Acompanhar 16 alertas moderados da cadeia de desenvolvimento |
| Ambiente | Imagem Docker e configuração operacional preparadas | HTTPS, segredos, armazenamento persistente e cadastros/revisões das plataformas |
| Desempenho | Concorrência local de reservas sem duplicação | Medir fila completa e latências/cotas das redes com carga definida |

## Informações da operação a preencher na etapa final

- Responsável pelo atendimento e prazo de resposta: a definir pela NexuSync.
- Hospedagem/banco/SMTP/backups/alertas: registrar fornecedor efetivo, região, finalidade, acesso e contato operacional. Configuração no repositório não comprova contratação.
- Recuperação: aprovar tempo máximo de indisponibilidade e perda máxima de dados; comparar com frequência real dos backups e ensaio medido.
- Retenção: revisar marco inicial, exceções e tratamento de conteúdo compartilhado. Não ativar expurgo antes da validação.

Documentos de execução: `OPERACAO-MVP.md`, `POLITICA-RETENCAO-PROPOSTA.md`, `GUIA-CONFIGURACAO-REDES.md`, `APROVACAO-REDES.md` e `TESTES-MVP.md`.

Facebook Pages suporta texto, foto e vídeo MP4. Facebook Reels/Stories/carrossel e TikTok fotos continuam fora do escopo atual. Sua inclusão deve ser uma etapa de produto própria, com validação das APIs e requisitos correspondentes.


## Ordem prática para concluir

1. NexuSync: revisar textos/política 180/30, responsável e prazo de atendimento, fornecedores/regiões e metas de recuperação. Essas decisões continuam abertas.
2. Preparar o ambiente final conforme o guia revisado: HTTPS, banco, volumes, SMTP, segredos e proxy; manter publicação desativada.
3. Cadastrar/configurar os apps sociais, conferir permissões Meta no painel e preparar submissões com o dossiê. Concluir as aprovações exigidas para a audiência pretendida.
4. Ensaiar operação no host: restauração completa, interrupções, monitor externo, recebimento dos alertas e recuperação de senha. Instalar cópia externa dos backups.
5. Revisar a fila, liberar publicação explicitamente e executar homologação por rede/formato e multiplataforma, medindo atrasos e duplicidade.
6. Implementar e validar exclusão efetiva após definição da política, incluindo dados da conta, referências de mídia, exceções e reaplicação de pedidos após restauração. O relatório atual não executa essa etapa.
7. Abrir piloto acompanhado somente após resolver defeitos críticos, revisar os alertas de dependências e registrar evidências dos cenários reais.

Últimas evidências locais: 65 testes aprovados na etapa de referências compartilhadas; TypeScript/lint e compilação Docker aprovados na etapa da home/temas; logos conferidos no navegador com TypeScript/lint. Essas verificações não foram todas repetidas em 03/11: esta etapa foi documental. Auditoria de dependências citada é a de 02/11, com zero alertas de produção e 16 moderados de desenvolvimento; repetir antes da instalação.
