import { Suspense } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  CalendarPlus,
  FileText,
  Users,
  ClipboardCheck,
} from 'lucide-react';
import SchedulingCalendar from '@/src/components/Calendar';
import CreatePostModal from '@/src/components/CreatePostModal';
import SignOutButton from '@/src/components/SignOutButton';
import BrandLogo from '@/src/components/BrandLogo';
import { InstagramIcon } from '@/src/components/icons/SocialIcons';
import { getCurrentUser } from '@/src/libs/authSession';
import { listPostsForWorkspace } from '@/src/data/posts';
import { getWorkspaceContext } from '@/src/data/workspaces';
import {
  canCreateWorkspacePosts,
  canReviewWorkspacePosts,
} from '@/src/libs/workspacePermissions';

const workspaceRoleLabels = {
  owner: 'proprietário',
  admin: 'administrador',
  editor: 'editor',
  approver: 'aprovador',
} as const;

async function ScheduledContent() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const workspace = await getWorkspaceContext(user.uid, user.email);
  const posts = await listPostsForWorkspace(workspace.workspaceId);
  const canCreatePosts = canCreateWorkspacePosts(workspace.role);
  const isMongoConfigured = Boolean(process.env.MONGODB_URI);

  return (
    <>
      <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1><Link href="/" aria-label="Arcsync — início"><BrandLogo /></Link></h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {workspace.workspaceName} · {workspaceRoleLabels[workspace.role]}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs"><Link href="/">Início</Link><a href="/monitoring" className="rounded border border-white/10 px-3 py-2">Monitoramento</a>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-slate-300">
            <span
              className={`h-1.5 w-1.5 rounded-full ${isMongoConfigured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
            />
            {isMongoConfigured ? 'Dados persistentes' : 'Modo demonstração'}
          </span>
          <span className="rounded-full border border-indigo-400/15 bg-indigo-400/[0.06] px-3 py-1.5 text-indigo-200">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </span>
          <Link
            href="/analytics"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-medium text-slate-300 transition hover:border-violet-400/25 hover:bg-white/[0.04] hover:text-violet-100"
          >
            <BarChart3 size={14} />
            Analytics
          </Link>
          <Link
            href="/settings/accounts"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-medium text-slate-300 transition hover:border-pink-400/25 hover:bg-white/[0.04] hover:text-pink-100"
          >
            <InstagramIcon size={14} />
            Contas sociais
          </Link>
          <Link
            href="/settings/team"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-medium text-slate-300 transition hover:border-indigo-400/25 hover:bg-white/[0.04] hover:text-indigo-100"
          >
            <Users size={14} />
            Equipe
          </Link>
          {canReviewWorkspacePosts(workspace.role) && (
            <Link
              href="/approvals"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs font-medium text-slate-300 transition hover:border-emerald-400/25 hover:bg-white/[0.04] hover:text-emerald-100"
            >
              <ClipboardCheck size={14} />
              Aprovações
            </Link>
          )}
          <SignOutButton email={user.email} />
        </div>
      </header>

      {posts.length === 0 && canCreatePosts && (
        <section
          aria-labelledby="getting-started-title"
          className="mt-6 overflow-hidden rounded-2xl border border-indigo-400/15 bg-gradient-to-br from-indigo-400/[0.08] via-[#11151f] to-violet-500/[0.04] p-5 sm:p-7"
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-200/75">
                Primeiros passos
              </p>
              <h2
                id="getting-started-title"
                className="mt-2 text-xl font-semibold text-white"
              >
                Seu calendário começa com uma ideia
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Crie um post, salve como rascunho ou escolha data e horário para
                organizar sua publicação. Instagram, Páginas do Facebook e YouTube podem ser
                publicados após conectar uma conta. O TikTok também pode ser
                agendado após conectar a conta e escolher as opções exigidas.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <CalendarPlus size={15} className="text-indigo-300" />
                  Agende pelo calendário
                </span>
                <span className="inline-flex items-center gap-2">
                  <FileText size={15} className="text-slate-300" />
                  Guarde ideias como rascunho
                </span>
              </div>
            </div>
            <Link
              href="#calendar"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 text-xs font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400"
            >
              <CalendarPlus size={15} />
              Criar primeiro post
            </Link>
          </div>
        </section>
      )}
      <SchedulingCalendar posts={posts} canCreatePosts={canCreatePosts} />
      {canCreatePosts && <CreatePostModal />}
    </>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-6 text-slate-200 selection:bg-indigo-500/30 sm:px-7 sm:py-9">
      <div className="mx-auto max-w-[1440px]">
        <Suspense
          fallback={
            <div className="flex min-h-[65vh] items-center justify-center text-sm text-slate-500">
              Carregando seu calendário...
            </div>
          }
        >
          <ScheduledContent />
        </Suspense>
      </div>
    </main>
  );
}
