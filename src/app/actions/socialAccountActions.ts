'use server';

import { redirect } from 'next/navigation';
import {
  getSocialAccountSecretsForWorkspace,
  isOAuthPlatform,
  removeSocialAccountForWorkspace,
  setDefaultSocialAccountForWorkspace,
  updateSocialAccountTokens,
  type OAuthPlatform,
} from '@/src/data/socialAccounts';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import {
  canCreateWorkspacePosts,
  canManageWorkspace,
} from '@/src/libs/workspacePermissions';
import {
  refreshTikTokTokens,
  getTikTokOAuthConfig,
  queryTikTokCreatorInfo,
  revokeTikTokToken,
} from '@/src/libs/tiktokOAuth';
import { getValidSocialAccessToken } from '@/src/libs/socialTokens';
import {
  getYouTubeOAuthConfig,
  refreshYouTubeTokens,
  revokeYouTubeToken,
} from '@/src/libs/youtubeOAuth';

function getStatus(platform: OAuthPlatform, status: string) {
  return `/settings/accounts?social=${platform}-${status}`;
}

export async function disconnectSocialAccount(
  platform: OAuthPlatform,
  accountId: string,
) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isOAuthPlatform(platform)) redirect('/settings/accounts?social=account-error');

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canManageWorkspace(workspace.role)) {
      redirect(getStatus(platform, 'permission-required'));
    }
    const secrets = await getSocialAccountSecretsForWorkspace(
      workspace.workspaceId,
      platform,
      accountId,
    );
    const removed = await removeSocialAccountForWorkspace(
      workspace.workspaceId,
      platform,
      accountId,
    );
    if (!removed) redirect(getStatus(platform, 'account-not-found'));

    if (secrets?.accessToken) {
      try {
        if (platform === 'tiktok') {
          await revokeTikTokToken(getTikTokOAuthConfig(), secrets.accessToken);
        } else if (platform === 'youtube') {
          await revokeYouTubeToken(secrets.accessToken);
        }
      } catch (error) {
        console.error(`Não foi possível revogar o token do ${platform}:`, error);
      }
    }
    redirect(getStatus(platform, 'disconnected'));
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    console.error(`Erro ao desconectar conta do ${platform}:`, error);
    redirect(getStatus(platform, 'disconnect-error'));
  }
}

export async function makeDefaultSocialAccount(
  platform: OAuthPlatform,
  accountId: string,
) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isOAuthPlatform(platform)) redirect('/settings/accounts?social=account-error');

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canManageWorkspace(workspace.role)) {
      redirect(getStatus(platform, 'permission-required'));
    }
    const updated = await setDefaultSocialAccountForWorkspace(
      workspace.workspaceId,
      platform,
      accountId,
    );
    redirect(
      updated
        ? getStatus(platform, 'default-updated')
        : getStatus(platform, 'account-not-found'),
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    console.error(`Erro ao definir a conta padrão do ${platform}:`, error);
    redirect(getStatus(platform, 'default-error'));
  }
}

export async function refreshSocialAccount(
  platform: OAuthPlatform,
  accountId: string,
) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isOAuthPlatform(platform)) redirect('/settings/accounts?social=account-error');

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canManageWorkspace(workspace.role)) {
      redirect(getStatus(platform, 'permission-required'));
    }
    const secrets = await getSocialAccountSecretsForWorkspace(
      workspace.workspaceId,
      platform,
      accountId,
    );
    if (!secrets?.refreshToken) {
      redirect(getStatus(platform, 'refresh-error'));
    }

    if (platform === 'facebook') redirect(getStatus(platform, 'refresh-error'));
    const tokens =
      platform === 'tiktok'
        ? await refreshTikTokTokens(
            getTikTokOAuthConfig(),
            secrets.refreshToken,
          )
        : await refreshYouTubeTokens(
            getYouTubeOAuthConfig(),
            secrets.refreshToken,
          );
    const updated = await updateSocialAccountTokens(
      workspace.workspaceId,
      platform,
      accountId,
      tokens,
    );
    redirect(
      updated
        ? getStatus(platform, 'token-refreshed')
        : getStatus(platform, 'account-not-found'),
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    console.error(`Erro ao renovar o token do ${platform}:`, error);
    redirect(getStatus(platform, 'refresh-error'));
  }
}

export async function getTikTokCreatorInfoForPost(accountId?: string) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      success: false as const,
      error: 'Sua sessão expirou. Entre novamente.',
    };
  }

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canCreateWorkspacePosts(workspace.role)) {
      return {
        success: false as const,
        error: 'Seu papel não permite criar publicações.',
      };
    }
    const accessToken = await getValidSocialAccessToken(workspace.workspaceId, 'tiktok', accountId);
    const creatorInfo = await queryTikTokCreatorInfo(accessToken);
    return {
      success: true as const,
      creatorInfo,
      publicPostingAllowed: process.env.TIKTOK_CLIENT_AUDITED === 'true',
    };
  } catch (error) {
    console.error('Não foi possível consultar as opções do TikTok:', error);
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar a conta TikTok.',
    };
  }
}
