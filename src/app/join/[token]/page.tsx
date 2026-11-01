import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { acceptWorkspaceInviteAction } from '@/src/app/actions/workspaceActions';
import { getWorkspaceInvitationPreview, hashWorkspaceInvitationToken } from '@/src/data/workspaces';
import { getCurrentUser } from '@/src/libs/authSession';
import type { WorkspaceInviteRole } from '@/src/data/workspaces';

const roleLabels: Record<WorkspaceInviteRole, string> = {
  admin: 'administrador',
  editor: 'editor',
  approver: 'aprovador',
};

interface JoinWorkspacePageProps {
  params: Promise<{ token: string }>;
}

async function JoinWorkspaceContent({
  params,
}: JoinWorkspacePageProps) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) redirect('/?invite=invalid');
  const invitation = await getWorkspaceInvitationPreview(
    hashWorkspaceInvitationToken(token),
  );
  if (!invitation) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-slate-200">
        <section className="max-w-md rounded-2xl border border-white/10 bg-[#11151f] p-7 text-center">
          <h1 className="text-xl font-semibold text-white">Convite inválido ou expirado</h1>
          <p className="mt-2 text-sm text-slate-400">
            Peça à pessoa administradora para gerar um novo link.
          </p>
        </section>
      </main>
    );
  }

  const user = await getCurrentUser();
  const acceptAction = acceptWorkspaceInviteAction.bind(null, token);
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-slate-200">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#11151f] p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
          Convite para equipe
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{invitation.workspaceName}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Você foi convidado como {roleLabels[invitation.role]} usando{' '}
          <span className="text-slate-200">{invitation.email}</span>.
        </p>
        {user ? (
          user.email.toLowerCase() === invitation.email ? (
            <form action={acceptAction} className="mt-6">
              <button
                type="submit"
                className="h-11 w-full rounded-lg bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                Aceitar convite
              </button>
            </form>
          ) : (
            <p className="mt-5 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100">
              Entre com a conta {invitation.email} para aceitar este convite.
            </p>
          )
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
              className="flex h-11 items-center justify-center rounded-lg bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400"
            >
              Entrar para aceitar
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
              className="text-center text-xs text-indigo-200 hover:text-white"
            >
              Ainda não tem conta? Crie uma com esse e-mail.
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

export default function JoinWorkspacePage(props: JoinWorkspacePageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Carregando convite...
        </main>
      }
    >
      <JoinWorkspaceContent {...props} />
    </Suspense>
  );
}
