import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AccountStorageUnavailableError } from '@/src/data/accounts';
import { saveSocialAccount } from '@/src/data/socialAccounts';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { canManageWorkspace } from '@/src/libs/workspacePermissions';
import { assertSocialTokenEncryptionConfigured } from '@/src/libs/socialTokenCrypto';
import {
  exchangeYouTubeAuthorizationCode,
  getYouTubeOAuthConfig,
} from '@/src/libs/youtubeOAuth';
import {
  SocialOAuthConfigurationError,
  SocialOAuthProviderError,
} from '@/src/libs/socialOAuth';
import { isMatchingOAuthState } from '@/src/libs/oauthState';

const STATE_COOKIE_NAME = 'feedsync_youtube_oauth_state';
const STATE_COOKIE_PATH = '/api/social/youtube';

type CallbackStatus =
  | 'youtube-connected'
  | 'youtube-cancelled'
  | 'youtube-invalid-state'
  | 'login-required'
  | 'youtube-configuration'
  | 'storage-required'
  | 'youtube-permission-required'
  | 'youtube-connection-error';

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
    return redirectToSettings(request, 'youtube-connection-error');
  }

  if (
    !isMatchingOAuthState(
      cookieStore.get(STATE_COOKIE_NAME)?.value,
      url.searchParams.get('state'),
      `${user.uid}:${workspace.workspaceId}`,
    )
  ) {
    return redirectToSettings(request, 'youtube-invalid-state');
  }
  if (url.searchParams.has('error')) {
    return redirectToSettings(request, 'youtube-cancelled');
  }

  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) {
    return redirectToSettings(request, 'youtube-connection-error');
  }

  try {
    assertSocialTokenEncryptionConfigured();
    const account = await exchangeYouTubeAuthorizationCode(
      getYouTubeOAuthConfig(),
      code,
    );
    await saveSocialAccount(workspace.workspaceId, user.uid, 'youtube', account);
    return redirectToSettings(request, 'youtube-connected');
  } catch (error) {
    if (error instanceof SocialOAuthConfigurationError) {
      return redirectToSettings(request, 'youtube-configuration');
    }
    if (error instanceof AccountStorageUnavailableError) {
      return redirectToSettings(request, 'storage-required');
    }
    if (error instanceof SocialOAuthProviderError) {
      console.error('A conexão com o YouTube não foi concluída:', error.message);
      return redirectToSettings(
        request,
        error.message.includes('permissão') || error.message.includes('permissões')
          ? 'youtube-permission-required'
          : 'youtube-connection-error',
      );
    }
    console.error('Erro ao finalizar OAuth do YouTube:', error);
    return redirectToSettings(request, 'youtube-connection-error');
  }
}
