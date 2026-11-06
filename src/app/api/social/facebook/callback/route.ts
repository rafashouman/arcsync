import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { publicUrl } from '@/src/libs/publicUrl';
import { AccountStorageUnavailableError } from '@/src/data/accounts';
import { saveSocialAccount } from '@/src/data/socialAccounts';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { canManageWorkspace } from '@/src/libs/workspacePermissions';
import { assertSocialTokenEncryptionConfigured } from '@/src/libs/socialTokenCrypto';
import {
  exchangeFacebookAuthorizationCode,
  getFacebookOAuthConfig,
} from '@/src/libs/facebookOAuth';
import {
  SocialOAuthConfigurationError,
  SocialOAuthProviderError,
} from '@/src/libs/socialOAuth';
import { isMatchingOAuthState } from '@/src/libs/oauthState';

const STATE_COOKIE_NAME = 'feedsync_facebook_oauth_state';
const STATE_COOKIE_PATH = '/api/social/facebook';

type CallbackStatus =
  | 'facebook-connected'
  | 'facebook-cancelled'
  | 'facebook-invalid-state'
  | 'login-required'
  | 'facebook-configuration'
  | 'storage-required'
  | 'facebook-permission-required'
  | 'facebook-connection-error';

function redirectToSettings(request: Request, status: CallbackStatus) {
  const response = NextResponse.redirect(
    publicUrl(`/settings/accounts?social=${status}`, request),
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
    return redirectToSettings(request, 'facebook-connection-error');
  }

  if (
    !isMatchingOAuthState(
      cookieStore.get(STATE_COOKIE_NAME)?.value,
      url.searchParams.get('state'),
      `${user.uid}:${workspace.workspaceId}`,
    )
  ) {
    return redirectToSettings(request, 'facebook-invalid-state');
  }
  if (url.searchParams.has('error')) {
    return redirectToSettings(request, 'facebook-cancelled');
  }

  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) {
    return redirectToSettings(request, 'facebook-connection-error');
  }

  try {
    assertSocialTokenEncryptionConfigured();
    const accounts = await exchangeFacebookAuthorizationCode(
      getFacebookOAuthConfig(),
      code,
    );
    for (const account of accounts) await saveSocialAccount(workspace.workspaceId, user.uid, 'facebook', account);
    return redirectToSettings(request, 'facebook-connected');
  } catch (error) {
    if (error instanceof SocialOAuthConfigurationError) {
      return redirectToSettings(request, 'facebook-configuration');
    }
    if (error instanceof AccountStorageUnavailableError) {
      return redirectToSettings(request, 'storage-required');
    }
    if (error instanceof SocialOAuthProviderError) {
      console.error('A conexão com o Facebook não foi concluída:', error.message);
      return redirectToSettings(
        request,
        error.message.includes('permissão') || error.message.includes('permissões')
          ? 'facebook-permission-required'
          : 'facebook-connection-error',
      );
    }
    console.error('Erro ao finalizar OAuth do Facebook:', error);
    return redirectToSettings(request, 'facebook-connection-error');
  }
}
