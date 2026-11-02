import { getOperationsHealth } from '@/src/data/operations';
import {historyEventLabel} from '@/src/libs/postHistory';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import MonitorRefresh from '@/src/components/MonitorRefresh';
import { listDeletedPostsForWorkspace, listPostsForWorkspace } from '@/src/data/posts';
import { publishingMonitor } from '@/src/libs/publishingMonitor';
async function Monitor() {
 await connection(); const user = await getCurrentUser(); if (!user) redirect('/login');
 const workspace = await getWorkspaceContext(user.uid,user.email);
 const [posts,deleted,health] = await Promise.all([listPostsForWorkspace(workspace.workspaceId),listDeletedPostsForWorkspace(workspace.workspaceId),getOperationsHealth()]);
 // Request-time server snapshot after connection(), never cached.
 // eslint-disable-next-line react-hooks/purity
 const issues = publishingMonitor(posts,Date.now());
 return <main className="mx-auto max-w-5xl space-y-6 p-8"><Link href="/calendar">Voltar à agenda</Link><h1 className="text-2xl">Monitoramento de publicações</h1><MonitorRefresh/><section aria-label="Estado do agendador" className="rounded border border-white/20 p-4"><h2 className="text-lg">Execução automática</h2><p role="status">{health.message}</p><p>Última execução: {health.lastStartedAt ?? "Ainda não registrada"}</p></section><p>Alertas da equipe atual. Atualização automática enquanto esta página estiver visível. Atraso: mais de dois minutos após o horário de cada destino.</p><p>{issues.length} alerta(s) · {posts.filter(p => p.status === 'processing').length} post(s) em processamento</p><ul>{issues.map(i => <li key={`${i.postId}:${i.platform}`} className="my-2 rounded border border-amber-500/30 p-3">{i.platform} — {i.issue} — {i.scheduledFor}<br/>Post: {i.postId}</li>)}</ul>{!issues.length && <p>Nenhum alerta encontrado nos posts desta equipe.</p>}<section><h2 className="text-xl">Histórico de posts excluídos</h2><p>Últimos 100 registros desta equipe. Excluir remove o post da fila, preservando a auditoria.</p>{deleted.map(post => <details key={post._id} className="my-2 rounded border border-white/10 p-3"><summary>{post.caption || 'Sem legenda'} — {post.deletedAt}</summary><ol>{post.history?.map((h,i)=><li key={i}>{h.at} — {historyEventLabel(h.event)}</li>)}</ol></details>)}</section></main>;
}
export default function Page() {return <Suspense fallback={<p>Carregando monitoramento...</p>}><Monitor/></Suspense>;}

