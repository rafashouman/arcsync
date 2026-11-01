'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { canManageWorkspace } from '@/src/libs/workspacePermissions';
import {
  getInstagramAccountCredentialsForWorkspace,
  removeInstagramAccountForWorkspace,
  setDefaultInstagramAccountForWorkspace,
  updateInstagramAccountToken,
} from '@/src/data/accounts';
import { decryptSocialToken, encryptSocialToken } from '@/src/libs/socialTokenCrypto';
import {
  getInstagramOAuthConfig,
  InstagramOAuthConfigurationError,
  InstagramOAuthProviderError,
  refreshInstagramLongLivedToken,
} from '@/src/libs/instagramOAuth';

export async function disconnectInstagramAccount(accountId: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canManageWorkspace(workspace.role)) {
      redirect('/settings/accounts?meta=permission-required');
    }
    const disconnected = await removeInstagramAccountForWorkspace(workspace.workspaceId, accountId);
    redirect(
      disconnected
        ? '/settings/accounts?meta=disconnected'
        : '/settings/accounts?meta=account-not-found',
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    console.error('Erro ao desconectar conta do Instagram:', error);
    redirect('/settings/accounts?meta=disconnect-error');
  }
}

export async function refreshInstagramAccount(accountId: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canManageWorkspace(workspace.role)) {
      redirect('/settings/accounts?meta=permission-required');
    }
    const account = await getInstagramAccountCredentialsForWorkspace(
      workspace.workspaceId,
      accountId,
    );
    if (!account) {
      redirect('/settings/accounts?meta=account-not-found');
    }

    const tokenAge =
      Date.now() - new Date(account.tokenIssuedAt).getTime();
    if (tokenAge < 24 * 60 * 60 * 1000) {
      redirect('/settings/accounts?meta=refresh-too-early');
    }
    if (new Date(account.expiresAt).getTime() <= Date.now()) {
      redirect('/settings/accounts?meta=token-expired');
    }

    const shortToken = decryptSocialToken(account.encryptedAccessToken);
    const refreshedToken = await refreshInstagramLongLivedToken(
      getInstagramOAuthConfig(),
      shortToken,
    );
    const tokenIssuedAt = new Date();
    const expiresAt = new Date(
      tokenIssuedAt.getTime() + refreshedToken.expires_in * 1000,
    );
    const updated = await updateInstagramAccountToken(
      workspace.workspaceId,
      accountId,
      encryptSocialToken(refreshedToken.access_token),
      tokenIssuedAt,
      expiresAt,
    );
    redirect(
      updated
        ? '/settings/accounts?meta=token-refreshed'
        : '/settings/accounts?meta=account-not-found',
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    if (error instanceof InstagramOAuthConfigurationError) {
      redirect('/settings/accounts?meta=configuration');
    }
    if (error instanceof InstagramOAuthProviderError) {
      console.error('A Meta recusou a renovação do token:', error.message);
      redirect('/settings/accounts?meta=refresh-error');
    }
    console.error('Erro ao renovar token do Instagram:', error);
    redirect('/settings/accounts?meta=refresh-error');
  }
}

export async function makeDefaultInstagramAccount(accountId: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canManageWorkspace(workspace.role)) {
      redirect('/settings/accounts?meta=permission-required');
    }
    const updated = await setDefaultInstagramAccountForWorkspace(workspace.workspaceId, accountId);
    redirect(
      updated
        ? '/settings/accounts?meta=default-updated'
        : '/settings/accounts?meta=account-not-found',
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    console.error('Erro ao definir conta padrão do Instagram:', error);
    redirect('/settings/accounts?meta=default-error');
  }
}
