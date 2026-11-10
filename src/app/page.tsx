import { Suspense } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, CalendarClock, CircleAlert, FilePenLine, Send } from 'lucide-react';
import { InstagramIcon, FacebookIcon, TikTokIcon, YoutubeIcon } from '@/src/components/icons/SocialIcons';
import styles from './home.module.css';
import PostButton from '@/src/components/PostButton';
import PostSummary from '@/src/components/PostSummary';
import CreatePostModal from '@/src/components/CreatePostModal';
import { listPostAccounts } from './actions/destinationActions';
import { canCreateWorkspacePosts, canManageWorkspace, canReviewWorkspacePosts } from '@/src/libs/workspacePermissions';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { listPostsForWorkspace } from '@/src/data/posts';
import SignOutButton from '@/src/components/SignOutButton';
import CalendarSummary from '@/src/components/CalendarSummary';

async function Dashboard() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const workspace = await getWorkspaceContext(user.uid, user.email);
  const [posts, connections] = await Promise.all([listPostsForWorkspace(workspace.workspaceId), listPostAccounts()]);
  const names = Object.fromEntries(connections.accounts.map(a => [a.id, a.name]));
  const create = canCreateWorkspacePosts(workspace.role);
  const review = canReviewWorkspacePosts(workspace.role);
  const connect = canManageWorkspace(workspace.role) && !connections.accounts.length && !connections.error;
  const now = new Date().getTime();
  const next = posts.filter(p => p.status === 'pending' && !['pending','rejected'].includes(p.approvalStatus ?? '') && Date.parse(p.scheduledFor ?? '') >= now)
    .sort((a,b) => Date.parse(a.scheduledFor!) - Date.parse(b.scheduledFor!))[0];
  const drafts = posts.filter(p => p.status === 'draft').sort((a,b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  const approvals = posts.filter(p => p.approvalStatus === 'pending').length;
  const counts = [
    { label: 'Agendados', key: 'pending', icon: CalendarClock, count: posts.filter(p => p.status === 'pending').length },
    { label: 'Rascunhos', key: 'draft', icon: FilePenLine, count: drafts.length },
    { label: 'Publicados', key: 'published', icon: Send, count: posts.filter(p => p.status === 'published').length },
    { label: 'Precisam de atenção', key: 'attention', icon: CircleAlert, count: posts.filter(p => p.status === 'failed' || p.publishMayHaveSucceeded).length },
  ];
  return <div className="dashboard">
    <header className="flex flex-wrap items-center justify-between gap-3 py-5"><span className="dashboard-muted text-sm">{workspace.workspaceName}</span><SignOutButton email={user.email}/></header>
    <section className={styles.hero} aria-labelledby="home-headline">
      <div className={styles.intro}>
        <h1 id="home-headline">Você cria.<br/><span>Nós publicamos.</span></h1>
        <p>{posts.length ? 'Organize seus conteúdos, programe suas postagens e deixe que nós cuidaremos das publicações por você.' : connect ? 'Conecte o primeiro perfil, agende suas postagens e nós cuidamos do resto' : connections.accounts.length ? `Perfil conectado: ${connections.accounts[0].name}. Sua agenda começa aqui.` : connections.error || 'Acompanhe aqui as publicações da equipe.'}</p>
        {!posts.length && connect ? <Link className="dashboard-primary" href="/settings/accounts">Conectar uma rede <ArrowUpRight size={16}/></Link> : create ? <PostButton className="dashboard-primary">{posts.length ? 'Nova publicação' : 'Criar primeira publicação'} <ArrowUpRight size={16}/></PostButton> : <Link href="/calendar" className="dashboard-primary">Ver agenda <ArrowUpRight size={16}/></Link>}
      </div>
      <div aria-hidden="true" className={styles.orbit}>
        <div className={styles.core}><Image src="/icon.png" width={64} height={64} alt=""/></div>
        {[InstagramIcon, FacebookIcon, YoutubeIcon, TikTokIcon].map((Icon, index) => <span className={styles.satellite} key={index}><Icon size={22}/></span>)}
      </div>
    </section>
    {posts.length > 0 && <section className="dashboard-panel mt-5 space-y-3"><h2 className="text-sm font-semibold">Próxima publicação</h2>{next ? <PostSummary post={next} names={names}/> : <p className="dashboard-muted text-sm">Nenhuma publicação pronta para ir ao ar.</p>}</section>}
    {review && approvals > 0 && <Link href="/approvals" className="dashboard-panel my-3 block">Revisar publicações · {approvals} aguardando aprovação →</Link>}
    <section className="dashboard-stats" aria-label="Resumo das publicações">{counts.map(item => <Link href={`/calendar?status=${item.key}#calendar`} className="dashboard-panel stat-link" key={item.key}><span className={styles.metricIcon} data-status={item.key}><item.icon size={18} aria-hidden="true"/></span><span className="dashboard-muted text-sm">{item.label}</span><p className="mt-2 text-3xl font-semibold">{item.count}</p></Link>)}</section>
    {create && drafts[0] && <section className="dashboard-panel my-5 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-sm font-semibold">Último rascunho</h2><p className="dashboard-muted truncate">{drafts[0].caption || 'Sem legenda'}</p></div><PostButton post={drafts[0]} className="dashboard-link">Continuar rascunho →</PostButton></section>}
    <CalendarSummary posts={posts}/>
    {create && <CreatePostModal/>}
  </div>;
}
export default function Home() {
  return <main><Suspense fallback={<p className="p-8">Carregando seu espaço…</p>}><Dashboard/></Suspense></main>;
}
