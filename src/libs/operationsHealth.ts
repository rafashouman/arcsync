export interface QueueRunSnapshot {
  startedAt: Date;
  finishedAt?: Date;
  outcome?: 'healthy' | 'degraded' | 'failed' | 'blocked';
}

export function assessQueueHealth(run: QueueRunSnapshot | null, now = Date.now()) {
  if (!run) return {status:'missing' as const, message:'O agendador ainda não registrou uma execução.'};
  if (now - run.startedAt.getTime() > 5 * 60_000) return {status:'stale' as const, message:'O agendador não registra execução há mais de cinco minutos.'};
  if (!run.finishedAt && now - run.startedAt.getTime() > 2 * 60_000) return {status:'stuck' as const, message:'A última execução não terminou no prazo esperado.'};
  if (run.outcome === 'failed' || run.outcome === 'blocked' || run.outcome === 'degraded') return {status:run.outcome,message:'A última execução teve falhas ou está bloqueada. Confira a configuração e os posts.'};
  return {status:run.finishedAt ? 'healthy' as const : 'running' as const,message:run.finishedAt ? 'Agendador em operação.' : 'Agendador executando.'};
}
