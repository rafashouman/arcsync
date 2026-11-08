export const logLabels = {
  created: 'Publicação criada', edited: 'Publicação editada', approved: 'Publicação aprovada',
  rejected: 'Ajustes solicitados', deleted: 'Publicação excluída', rescheduled: 'Horário alterado',
  manual_retry: 'Nova tentativa solicitada', published: 'Envio concluído', retry: 'Nova tentativa programada',
  failed: 'Falha no envio', uncertain: 'Resultado do envio incerto', 'lost-claim': 'Reserva de processamento perdida',
  'worker-error': 'Erro ao processar o envio',
} as const;

export type LogEvent = keyof typeof logLabels;
export type LogLevel = 'info' | 'warning' | 'error';
export const logRetentionMs = 7 * 24 * 60 * 60 * 1000;

export function logLevel(event: LogEvent): LogLevel {
  if (event === 'failed' || event === 'worker-error' || event === 'uncertain') return 'error';
  if (event === 'retry' || event === 'lost-claim' || event === 'rejected') return 'warning';
  return 'info';
}
