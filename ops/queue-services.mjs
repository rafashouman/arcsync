import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export function serviceConfig(env = process.env) {
  const origin = new URL(env.QUEUE_APP_URL || 'http://localhost:3000');
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('QUEUE_APP_URL inválida.');
  if (!env.CRON_SECRET || env.CRON_SECRET.length < 32) throw new Error('CRON_SECRET ausente ou inválido.');
  return {origin:origin.origin,secret:env.CRON_SECRET,enabled:env.PUBLISHING_ENABLED === 'true',webhook:env.OPERATIONS_ALERT_WEBHOOK || ''};
}

export async function queueTick(config, fetcher = fetch) {
  if (!config.enabled) return {status:'disabled'};
  try {
    const response = await fetcher(`${config.origin}/api/cron/publish`, {method:'POST',headers:{Authorization:`Bearer ${config.secret}`},redirect:'error',signal:AbortSignal.timeout(90_000)});
    const body = await response.json().catch(() => ({}));
    return {status:response.status === 207 ? 'degraded' : response.ok ? 'healthy' : 'failed',processed:Number.isSafeInteger(body.processed) ? body.processed : 0};
  } catch { return {status:'unreachable',processed:0}; }
}

export async function monitorTick(config, previous, fetcher = fetch, log = console.log) {
  let status = 'unreachable';
  try {
    const response = await fetcher(`${config.origin}/api/health/operations`, {headers:{Authorization:`Bearer ${config.secret}`},redirect:'error',signal:AbortSignal.timeout(15_000)});
    const body = await response.json().catch(() => ({}));
    const allowed = ['healthy','running','missing','stale','stuck','degraded','failed','blocked','unavailable'];
    status = response.status === 401 ? 'unauthorized' : allowed.includes(body.status) ? body.status : 'unavailable';
  } catch { /* Treat connection failure as an actionable state. */ }
  const state = ['healthy','running'].includes(status) ? 'healthy' : status;
  if (state === previous || (previous === undefined && state === 'healthy')) return state;
  const event = {service:'arcsync-queue',status:state,at:new Date().toISOString(),event:state === 'healthy' ? 'recovered' : 'attention-required'};
  log(JSON.stringify(event));
  if (config.webhook) {
    const target = new URL(config.webhook);
    if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Webhook de alertas deve usar HTTPS.');
    const response = await fetcher(target,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),redirect:'error',signal:AbortSignal.timeout(15_000)});
    if (!response.ok) throw new Error('Não foi possível entregar o alerta.');
  }
  return state;
}

async function main() {
  const mode = process.argv[2];
  if (!['scheduler','monitor'].includes(mode)) throw new Error('Use scheduler ou monitor.');
  const config = serviceConfig();
  let previous;
  const shutdown = new AbortController();
  for (const signal of ['SIGTERM','SIGINT']) process.on(signal,() => shutdown.abort());
  while (!shutdown.signal.aborted) {
    const started = Date.now();
    try {
      if (mode === 'scheduler') console.log(JSON.stringify({service:'arcsync-scheduler',...await queueTick(config),at:new Date().toISOString()}));
      else previous = await monitorTick(config,previous);
    } catch { console.error('Falha no serviço operacional; nova tentativa no próximo ciclo.'); }
    // Never overlap a request with the next tick or log secrets/remote error bodies.
    await delay(Math.max(1_000,60_000-(Date.now()-started)),undefined,{signal:shutdown.signal}).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {console.error('Configuração operacional inválida.');process.exitCode=1;});
