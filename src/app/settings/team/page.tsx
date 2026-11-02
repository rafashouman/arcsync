import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import SignOutButton from '@/src/components/SignOutButton';
import WorkspaceTeamPanel from '@/src/components/WorkspaceTeamPanel';
import {
  getWorkspaceContext,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  listWorkspaceMemberships,
} from '@/src/data/workspaces';
import { getCurrentUser } from '@/src/libs/authSession';
import { canManageWorkspace } from '@/src/libs/workspacePermissions';

export const metadata: Metadata = {
  title: 'Equipe | FeedSync',
  description: 'Gerencie os membros e papéis do seu workspace FeedSync.',
};

async function TeamContent() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const workspace = await getWorkspaceContext(user.uid, user.email);
  const [memberships, members, invitations] = await Promise.all([
    listWorkspaceMemberships(user.uid, workspace.workspaceId),
    listWorkspaceMembers(workspace.workspaceId),
    canManageWorkspace(workspace.role)
      ? listWorkspaceInvitations(workspace.workspaceId)
      : Promise.resolve([]),
  ]);

  return (
    <main className="min-h-screen px-4 py-6 text-slate-200 sm:px-7 sm:py-9">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
            <ArrowLeft size={16} />
            Voltar ao início
          </Link>
          <SignOutButton email={user.email} />
        </header>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
            Configurações
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Equipe e permissões</h1>
          <p className="mt-2 text-sm text-slate-400">
            Convide pessoas e defina quem cria, revisa e gerencia contas sociais.
          </p>
        </div>
        <WorkspaceTeamPanel
          workspaceName={workspace.workspaceName}
          currentUserId={user.uid}
          role={workspace.role}
          memberships={memberships}
          members={members}
          invitations={invitations}
        />
      </div>
    </main>
  );
}

export default function TeamPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Carregando equipe...
        </main>
      }
    >
      <TeamContent />
    </Suspense>
  );
}
