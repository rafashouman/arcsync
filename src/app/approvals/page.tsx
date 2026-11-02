import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import ApprovalQueue from '@/src/components/ApprovalQueue';
import SignOutButton from '@/src/components/SignOutButton';
import { listPendingApprovalPosts } from '@/src/data/posts';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { getCurrentUser } from '@/src/libs/authSession';
import { canReviewWorkspacePosts } from '@/src/libs/workspacePermissions';

export const metadata: Metadata = {
  title: 'Aprovações | FeedSync',
  description: 'Revise as publicações da sua equipe antes do envio.',
};

async function ApprovalsContent() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const workspace = await getWorkspaceContext(user.uid, user.email);
  if (!canReviewWorkspacePosts(workspace.role)) redirect('/');
  const posts = await listPendingApprovalPosts(workspace.workspaceId);

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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
            {workspace.workspaceName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Aprovações</h1>
          <p className="mt-2 text-sm text-slate-400">
            Posts de editores não são publicados até a aprovação. Rejeições exigem um comentário.
          </p>
        </div>
        <ApprovalQueue posts={posts} />
      </div>
    </main>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Carregando aprovações...
        </main>
      }
    >
      <ApprovalsContent />
    </Suspense>
  );
}
