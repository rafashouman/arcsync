import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { canManageWorkspace } from '@/src/libs/workspacePermissions';
import {
  AccountStorageUnavailableError,
} from '@/src/data/accounts';
import { saveSocialAccount } from '@/src/data/socialAccounts';
import { assertSocialTokenEncryptionConfigured } from '@/src/libs/socialTokenCrypto';
import {
  exchangeTikTokAuthorizationCode,
  getTikTokOAuthConfig,
} from '@/src/libs/tiktokOAuth';
import {
  SocialOAuthConfigurationError,
  SocialOAuthProviderError,
} from '@/src/libs/socialOAuth';
import { isMatchingOAuthState } from '@/src/libs/oauthState';

const STATE_COOKIE_NAME = 'feedsync_tiktok_oauth_state';
const STATE_COOKIE_PATH = '/api/social/tiktok';

type CallbackStatus =
  | 'tiktok-connected'
  | 'tiktok-cancelled'
  | 'tiktok-invalid-state'
  | 'login-required'
  | 'tiktok-configuration'
  | 'storage-required'
  | 'tiktok-permission-required'
  | 'tiktok-connection-error';

function redirectToSettings(request: Request, status: CallbackStatus) {
  const response = NextResponse.redirect(
    new URL(`/settings/accounts?social=${status}`, request.url),
  );
  response.cookies.set(STATE_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: STATE_COOKIE_PATH,
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const user = await getCurrentUser();
  if (!user) return redirectToSettings(request, 'login-required');
  const workspace = await getWorkspaceContext(user.uid, user.email);
  if (!canManageWorkspace(workspace.role)) {
    return redirectToSettings(request, 'tiktok-connection-error');
  }

  if (
    !isMatchingOAuthState(
      cookieStore.get(STATE_COOKIE_NAME)?.value,
      url.searchParams.get('state'),
      `${user.uid}:${workspace.workspaceId}`,
    )
  ) {
    return redirectToSettings(request, 'tiktok-invalid-state');
  }
  if (url.searchParams.has('error')) {
    return redirectToSettings(request, 'tiktok-cancelled');
  }

  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) {
    return redirectToSettings(request, 'tiktok-connection-error');
  }

  try {
    assertSocialTokenEncryptionConfigured();
    const account = await exchangeTikTokAuthorizationCode(
      getTikTokOAuthConfig(),
      code,
    );
    await saveSocialAccount(workspace.workspaceId, user.uid, 'tiktok', account);
    return redirectToSettings(request, 'tiktok-connected');
  } catch (error) {
    if (error instanceof SocialOAuthConfigurationError) {
      return redirectToSettings(request, 'tiktok-configuration');
    }
    if (error instanceof AccountStorageUnavailableError) {
      return redirectToSettings(request, 'storage-required');
    }
    if (error instanceof SocialOAuthProviderError) {
      console.error('A conexão com o TikTok não foi concluída:', error.message);
      return redirectToSettings(
        request,
        error.message.includes('permissões')
          ? 'tiktok-permission-required'
          : 'tiktok-connection-error',
      );
    }
    console.error('Erro ao finalizar OAuth do TikTok:', error);
    return redirectToSettings(request, 'tiktok-connection-error');
  }
}
