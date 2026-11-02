import { Suspense } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, FileText, Radio, Users, BarChart3 } from 'lucide-react';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { listPostsForWorkspace } from '@/src/data/posts';
import SignOutButton from '@/src/components/SignOutButton';
import BrandLogo from '@/src/components/BrandLogo';

async function Dashboard() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const workspace = await getWorkspaceContext(user.uid, user.email);
  const posts = await listPostsForWorkspace(workspace.workspaceId);
  const counts = [
    { label: 'Agendados', value: posts.filter(p => p.status === 'pending').length },
    { label: 'Rascunhos', value: posts.filter(p => p.status === 'draft').length },
    { label: 'Publicados', value: posts.filter(p => p.status === 'published').length },
    { label: 'Precisam de atenção', value: posts.filter(p => p.status === 'failed' || p.publishMayHaveSucceeded).length },
  ];
  return <div className="dashboard">
    <header className="dashboard-header"><Link href="/" className="brand" aria-label="FeedSync — início"><BrandLogo /></Link><div className="flex flex-wrap items-center gap-4"><span className="dashboard-muted text-sm">{workspace.workspaceName}</span><SignOutButton email={user.email}/></div></header>
    <nav className="dashboard-nav" aria-label="Navegação principal"><Link href="/" aria-current="page">Início</Link><Link href="/calendar">Calendário</Link><Link href="/monitoring">Monitoramento</Link><Link href="/settings/accounts">Contas sociais</Link></nav>
    <section className="dashboard-hero"><div><p className="dashboard-eyebrow">SEU ESPAÇO DE CRIAÇÃO</p><h1>Boas ideias merecem<br/>ganhar o mundo.</h1><p className="dashboard-muted mt-5 max-w-lg leading-7">Organize seus conteúdos, acompanhe as publicações e planeje os próximos passos da sua presença nas redes.</p><Link className="dashboard-primary mt-7" href="/calendar">Planejar publicações <ArrowUpRight size={18}/></Link></div><div className="hero-art" aria-hidden="true"><div className="hero-card"><CalendarDays size={42}/><span>Uma ideia.<br/>Muitas possibilidades.</span><div className="hero-dots"><i/><i/><i/><i/></div></div><span className="hero-label">CRIE · PLANEJE · PUBLIQUE</span></div></section>
    <section className="dashboard-stats" aria-label="Resumo das publicações">{counts.map(item => <div className="dashboard-panel" key={item.label}><span className="dashboard-muted text-sm">{item.label}</span><p className="mt-3 text-3xl font-semibold">{item.value}</p></div>)}</section>
    <div className="dashboard-columns"><section className="dashboard-panel"><h2 className="text-lg font-semibold">Seu planejamento começa aqui</h2><p className="dashboard-muted mt-3 leading-7">Reserve um momento para suas próximas ideias. No calendário, você pode criar rascunhos e definir a publicação em cada rede.</p><Link href="/calendar" className="dashboard-link mt-6">Abrir calendário <ArrowUpRight size={16}/></Link></section>
    <section className="dashboard-panel"><h2 className="text-lg font-semibold">Tudo no seu lugar</h2><div className="mt-4">{[
      {href:'/settings/accounts',icon:Radio,title:'Contas sociais',text:'Conecte e gerencie suas redes'},
      {href:'/analytics',icon:BarChart3,title:'Analytics',text:'Explore os dados disponíveis'},
      {href:'/settings/team',icon:Users,title:'Sua equipe',text:'Organize a colaboração'},
      {href:'/approvals',icon:FileText,title:'Aprovações',text:'Acompanhe as revisões'},
    ].map(item => <Link className="dashboard-recent" href={item.href} key={item.href}><span className="dashboard-icon"><item.icon size={19}/></span><span className="flex-1"><span className="block text-sm font-medium">{item.title}</span><span className="dashboard-muted text-xs">{item.text}</span></span><ArrowUpRight size={16}/></Link>)}</div></section></div>
    <footer className="dashboard-muted py-8 text-xs">FeedSync · Mais espaço para criar.</footer>
  </div>;
}
export default function Home() {
  return <main><Suspense fallback={<p className="p-8">Carregando seu espaço…</p>}><Dashboard/></Suspense></main>;
}
