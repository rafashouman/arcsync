# Pendências finais do MVP — NexuSync

Atualizado em 02/11/2026. Este documento distingue preparação local de ativação operacional; nenhum teste simulado comprova aprovação ou publicação real.

| Frente | Preparação disponível | Condição ainda necessária |
|---|---|---|
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

Facebook Reels/Stories/carrossel e TikTok fotos continuam fora do escopo atual. Sua inclusão deve ser uma etapa de produto própria, com validação das APIs e requisitos correspondentes.
