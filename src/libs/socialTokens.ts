import 'server-only';

import {
  getDefaultSocialAccountForWorkspace,
  updateSocialAccountTokens,
  type OAuthPlatform,
} from '@/src/data/socialAccounts';
import { decryptSocialToken } from '@/src/libs/socialTokenCrypto';
import { PlatformPublishError } from '@/src/libs/publishTypes';
import {
  getTikTokOAuthConfig,
  refreshTikTokTokens,
} from '@/src/libs/tiktokOAuth';
import {
  getYouTubeOAuthConfig,
  refreshYouTubeTokens,
} from '@/src/libs/youtubeOAuth';
import {
  SocialOAuthConfigurationError,
  SocialOAuthProviderError,
  type OAuthTokenSet,
} from '@/src/libs/socialOAuth';

const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const PLATFORM_LABEL: Record<OAuthPlatform, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

async function refreshTokens(
  platform: OAuthPlatform,
  refreshToken: string,
): Promise<OAuthTokenSet> {
  return platform === 'tiktok'
    ? refreshTikTokTokens(getTikTokOAuthConfig(), refreshToken)
    : refreshYouTubeTokens(getYouTubeOAuthConfig(), refreshToken);
}

export async function getValidSocialAccessToken(
  workspaceId: string,
  platform: OAuthPlatform,
) {
  const label = PLATFORM_LABEL[platform];
  const account = await getDefaultSocialAccountForWorkspace(workspaceId, platform);
  if (!account) {
    throw new PlatformPublishError(
      `Nenhuma conta padrão do ${label} está conectada.`,
    );
  }

  const now = Date.now();
  if (account.accessTokenExpiresAt.getTime() - now > REFRESH_MARGIN_MS) {
    try {
      return decryptSocialToken(account.encryptedAccessToken);
    } catch {
      throw new PlatformPublishError(
        `Não foi possível descriptografar o token do ${label}. Reconecte a conta.`,
      );
    }
  }

  if (
    !account.encryptedRefreshToken ||
    (account.refreshTokenExpiresAt && account.refreshTokenExpiresAt.getTime() <= now)
  ) {
    throw new PlatformPublishError(
      `A autorização do ${label} expirou. Reconecte a conta antes de publicar.`,
    );
  }

  let refreshToken: string;
  try {
    refreshToken = decryptSocialToken(account.encryptedRefreshToken);
  } catch {
    throw new PlatformPublishError(
      `Não foi possível descriptografar o token do ${label}. Reconecte a conta.`,
    );
  }

  try {
    const refreshed = await refreshTokens(platform, refreshToken);
    const saved = await updateSocialAccountTokens(
      workspaceId,
      platform,
      account.id,
      refreshed,
    );
    if (!saved) {
      throw new PlatformPublishError(
        `Não foi possível salvar o token renovado do ${label}.`,
      );
    }
    return refreshed.accessToken;
  } catch (error) {
    if (error instanceof PlatformPublishError) throw error;
    if (error instanceof SocialOAuthConfigurationError) {
      throw new PlatformPublishError(error.message);
    }
    if (error instanceof SocialOAuthProviderError) {
      throw new PlatformPublishError(
        `O ${label} recusou a renovação da autorização. Reconecte a conta.`,
      );
    }
    throw error;
  }
}
