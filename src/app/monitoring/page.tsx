import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Activity, AlertTriangle, Clock3, Layers, ListTree, Archive, CircleCheck, CircleAlert, Info } from 'lucide-react';
import { getOperationsHealth } from '@/src/data/operations';
import { listPublicationLogs } from '@/src/data/monitorLogs';
import { logLabels, type LogLevel } from '@/src/libs/monitorLogs';
import { historyEventLabel } from '@/src/libs/postHistory';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import MonitorRefresh from '@/src/components/MonitorRefresh';
import { listDeletedPostsForWorkspace, listPostsForWorkspace } from '@/src/data/posts';
import { publishingMonitor } from '@/src/libs/publishingMonitor';
import styles from './monitor.module.css';

const levels = { info: 'Informações', warning: 'Avisos', error: 'Erros' };
const icons = { info: Info, warning: AlertTriangle, error: CircleAlert };
const healthLabels = {
  healthy: 'Operacional', running: 'Em execução', missing: 'Sem registro', unavailable: 'Indisponível',
  stale: 'Sem atualização', stuck: 'Execução atrasada', degraded: 'Com falhas', failed: 'Falhou', blocked: 'Bloqueado',
};
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo',
});
function timestamp(input?: string | Date | null) {
  if (!input) return 'Sem registro';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Sem horário';
  return <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time>;
}

async function Monitor({ searchParams }: PageProps<'/monitoring'>) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const workspace = await getWorkspaceContext(user.uid, user.email);
  const rawLevel = (await searchParams).nivel;
  const level = typeof rawLevel === 'string' && Object.hasOwn(levels, rawLevel) ? rawLevel as LogLevel : undefined;
  const [posts, deleted, health, logs] = await Promise.all([
    listPostsForWorkspace(workspace.workspaceId), listDeletedPostsForWorkspace(workspace.workspaceId),
    getOperationsHealth(), listPublicationLogs(workspace.workspaceId, level),
  ]);
  const issues = publishingMonitor(posts, new Date().getTime());
  const captions = new Map([...posts, ...deleted].map(post => [post._id, post.caption]));
  const healthy = health.status === 'healthy' || health.status === 'running';

  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.workspace}>{workspace.workspaceName}</p>
      <h1>Monitoramento</h1><p>Publicações, alertas e atividade da equipe · Horário de Brasília</p></div><MonitorRefresh/></header>

    <section className={styles.metrics} aria-label="Estado da operação">
      <article className={styles.metric} data-tone={healthy ? 'success' : 'warning'}><Activity aria-hidden="true"/><h2>Agendador</h2>
        <strong>{healthLabels[health.status]}</strong><p role="status">{health.message}</p>
        <small>Última execução · {timestamp(health.lastStartedAt)}</small></article>
      <article className={styles.metric} data-tone={issues.length ? 'warning' : 'success'}><AlertTriangle aria-hidden="true"/><h2>Alertas da equipe</h2>
        <strong>{issues.length}</strong><p>Falhas, resultados incertos e atrasos por destino.</p></article>
      <article className={styles.metric}><Layers aria-hidden="true"/><h2>Em processamento</h2>
        <strong>{posts.filter(post => post.status === 'processing').length}</strong><p>Publicações que a fila está processando.</p></article>
    </section>

    <section className={styles.panel}><h2><Activity size={20}/> Alertas ativos</h2>
      {issues.length ? <><p>Atrasos são sinalizados dois minutos após o horário do destino.</p><ul>{issues.map(i =>
        <li className={styles.row} key={i.postId + i.platform}><AlertTriangle size={18} className={styles.warning}/><div><b>{i.issue} · {i.platform}</b>
          <p>{captions.get(i.postId) || 'Publicação sem legenda'}</p><small>Post {i.postId}</small></div><small>{timestamp(i.scheduledFor)}</small></li>)}</ul></>
        : <p className={styles.empty}><CircleCheck size={18}/> Nenhum alerta ativo nesta equipe.</p>}</section>

    <section id="logs" className={styles.panel}><h2><ListTree size={20}/> Registro de atividade</h2>
      <p>Até 100 eventos mais recentes dos últimos 7 dias.</p>
      <nav className={styles.filters} aria-label="Filtrar registros por nível">
        <Link aria-current={!level ? 'page' : undefined} href="/monitoring#logs">Todos</Link>
        {Object.entries(levels).map(([key, label]) => <Link key={key} aria-current={level === key ? 'page' : undefined} href={`/monitoring?nivel=${key}#logs`}>{label}</Link>)}
      </nav>
      {!logs.available ? <p role="status">Registros indisponíveis. Tente atualizar em instantes.</p> :
        !logs.entries.length ? <p className={styles.empty}><Clock3 size={18}/> Nenhum evento neste período para o filtro selecionado.</p> :
        <ol>{logs.entries.map(entry => {
          const Icon = icons[entry.level];
          return <li key={entry._id} className={styles.row}><Icon size={18} data-tone={entry.level}/>
            <div><b>{logLabels[entry.event]}</b>{entry.platform && <span className={styles.platform}> · {entry.platform}</span>}
              <p>{captions.get(entry.postId) || 'Publicação'} · <small>{entry.postId}</small></p></div>
            <small>{timestamp(entry.at)}</small></li>;
        })}</ol>}
    </section>

    <section className={styles.panel}><h2><Archive size={19}/> Histórico de posts excluídos</h2>
      <p>{deleted.length ? 'Últimas 100 exclusões da equipe. Abra uma publicação para consultar seu histórico.' : 'Nenhuma publicação excluída nesta equipe.'}</p>
      {deleted.map(post => <details key={post._id}><summary>{post.caption || 'Sem legenda'} · {timestamp(post.deletedAt)}</summary>
        <ol>{post.history?.map((h, index) => <li key={index}>{timestamp(h.at)} · {historyEventLabel(h.event)}</li>)}</ol></details>)}</section>
    <Link className="dashboard-link" href="/calendar">Voltar à agenda →</Link>
  </main>;
}
export default function Page(props: PageProps<'/monitoring'>) {
  return <Suspense fallback={<p className="p-8">Carregando monitoramento…</p>}><Monitor {...props}/></Suspense>;
}
