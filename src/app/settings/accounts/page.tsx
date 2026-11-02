import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, Settings2 } from 'lucide-react';
import SignOutButton from '@/src/components/SignOutButton';
import InstagramAccounts from '@/src/components/InstagramAccounts';
import OAuthSocialAccounts from '@/src/components/OAuthSocialAccounts';
import { listInstagramAccountsForWorkspace } from '@/src/data/accounts';
import {
  listSocialAccountsForWorkspace,
  type OAuthPlatform,
} from '@/src/data/socialAccounts';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { canManageWorkspace } from '@/src/libs/workspacePermissions';
import { hasSocialTokenEncryptionKey } from '@/src/libs/socialTokenCrypto';

export const metadata: Metadata = {
  title: 'Contas sociais | FeedSync',
  description: 'Gerencie as contas sociais conectadas ao FeedSync.',
};

interface AccountsPageProps {
  searchParams: Promise<{ meta?: string; social?: string }>;
}

async function AccountsContent({ searchParams }: AccountsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const workspace = await getWorkspaceContext(user.uid, user.email);
  const canManageAccounts = canManageWorkspace(workspace.role);
  const [{ meta, social }, instagramAccounts, tiktokAccounts, youtubeAccounts, facebookAccounts] = await Promise.all([
    searchParams,
    process.env.MONGODB_URI
      ? listInstagramAccountsForWorkspace(workspace.workspaceId)
      : Promise.resolve([]),
    process.env.MONGODB_URI
      ? listSocialAccountsForWorkspace(workspace.workspaceId, 'tiktok')
      : Promise.resolve([]),
    process.env.MONGODB_URI
      ? listSocialAccountsForWorkspace(workspace.workspaceId, 'youtube')
      : Promise.resolve([]),
    process.env.MONGODB_URI ? listSocialAccountsForWorkspace(workspace.workspaceId, 'facebook') : Promise.resolve([]),
  ]);
  const isOAuthConfigured = Boolean(
    process.env.INSTAGRAM_APP_ID &&
      process.env.INSTAGRAM_APP_SECRET &&
      process.env.INSTAGRAM_REDIRECT_URI,
  );
  const socialOAuthConfigured: Record<OAuthPlatform, boolean> = {
    facebook: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET && process.env.FACEBOOK_REDIRECT_URI),
    tiktok: Boolean(
      process.env.TIKTOK_CLIENT_KEY &&
        process.env.TIKTOK_CLIENT_SECRET &&
        process.env.TIKTOK_REDIRECT_URI,
    ),
    youtube: Boolean(
      process.env.YOUTUBE_CLIENT_ID &&
        process.env.YOUTUBE_CLIENT_SECRET &&
        process.env.YOUTUBE_REDIRECT_URI,
    ),
  };

  return (
    <main className="min-h-screen px-4 py-6 text-slate-200 sm:px-7 sm:py-9">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Voltar ao início
          </Link>
          <SignOutButton email={user.email} />
        </header>

        <div className="mb-6 flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
            <Settings2 size={19} />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-white">Contas sociais</h1>
            <p className="mt-1 text-sm text-slate-500">
              Contas compartilhadas com o workspace {workspace.workspaceName}.
            </p>
          </div>
        </div>

        <InstagramAccounts
          accounts={instagramAccounts}
          status={meta}
          hasMongo={Boolean(process.env.MONGODB_URI)}
          hasEncryptionKey={hasSocialTokenEncryptionKey()}
          isOAuthConfigured={isOAuthConfigured}
          canManageAccounts={canManageAccounts}
        />
        <OAuthSocialAccounts
          accounts={{
            facebook: facebookAccounts,
            tiktok: tiktokAccounts,
            youtube: youtubeAccounts,
          }}
          status={social}
          hasMongo={Boolean(process.env.MONGODB_URI)}
          hasEncryptionKey={hasSocialTokenEncryptionKey()}
          configured={socialOAuthConfigured}
          canManageAccounts={canManageAccounts}
        />
      </div>
    </main>
  );
}

export default function AccountsPage(props: AccountsPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Carregando contas sociais...
        </main>
      }
    >
      <AccountsContent {...props} />
    </Suspense>
  );
}
