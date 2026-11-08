import { Suspense } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { listPostAccounts } from '../actions/destinationActions';
import SchedulingCalendar from '@/src/components/Calendar';
import CreatePostModal from '@/src/components/CreatePostModal';
import SignOutButton from '@/src/components/SignOutButton';

import { getCurrentUser } from '@/src/libs/authSession';
import { listPostsForWorkspace } from '@/src/data/posts';
import { getWorkspaceContext } from '@/src/data/workspaces';
import {
  canCreateWorkspacePosts,

} from '@/src/libs/workspacePermissions';

const workspaceRoleLabels = {
  owner: 'proprietário',
  admin: 'administrador',
  editor: 'editor',
  approver: 'aprovador',
} as const;

async function ScheduledContent({searchParams}: PageProps<'/calendar'>) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const workspace = await getWorkspaceContext(user.uid, user.email);
  const [posts, connections, query] = await Promise.all([listPostsForWorkspace(workspace.workspaceId), listPostAccounts(), searchParams]);
  const status = typeof query.status === 'string' && ['draft','pending','published','attention'].includes(query.status) ? query.status : 'all';
  const names = Object.fromEntries(connections.accounts.map(a => [a.id, a.name]));
  const canCreatePosts = canCreateWorkspacePosts(workspace.role);
  const isMongoConfigured = Boolean(process.env.MONGODB_URI);

  return (
    <>
      <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold">Calendário</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {workspace.workspaceName} · {workspaceRoleLabels[workspace.role]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">{!isMongoConfigured && <span className="dashboard-muted text-xs">Modo demonstração</span>}
          <SignOutButton email={user.email} />
        </div>
      </header>

      <SchedulingCalendar key={status} initialFilter={status} posts={posts} names={names} canCreatePosts={canCreatePosts} />
      {canCreatePosts && <CreatePostModal />}
    </>
  );
}

export default function Home(props: PageProps<'/calendar'>) {
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
          <ScheduledContent {...props} />
        </Suspense>
      </div>
    </main>
  );
}
