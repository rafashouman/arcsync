import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { canManageWorkspace } from '@/src/libs/workspacePermissions';
import {
  AccountStorageUnavailableError,
  saveInstagramAccount,
} from '@/src/data/accounts';
import { assertSocialTokenEncryptionConfigured } from '@/src/libs/socialTokenCrypto';
import {
  exchangeInstagramAuthorizationCodeForAccounts,
  getInstagramOAuthConfig,
  InstagramOAuthConfigurationError,
  InstagramOAuthProviderError,
} from '@/src/libs/instagramOAuth';
import { isMatchingOAuthState } from '@/src/libs/oauthState';

const STATE_COOKIE_NAME = 'feedsync_meta_oauth_state';
const STATE_COOKIE_PATH = '/api/social/meta';

type CallbackStatus =
  | 'connected'
  | 'cancelled'
  | 'invalid-state'
  | 'login-required'
  | 'configuration'
  | 'storage-required'
  | 'permission-required'
  | 'connection-error';

function redirectToSettings(request: Request, status: CallbackStatus) {
  const response = NextResponse.redirect(
    new URL(`/settings/accounts?meta=${status}`, request.url),
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

function getProviderErrorCode(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const user = await getCurrentUser();
  if (!user) {
    return redirectToSettings(request, 'login-required');
  }
  const workspace = await getWorkspaceContext(user.uid, user.email);
  if (!canManageWorkspace(workspace.role)) {
    return redirectToSettings(request, 'permission-required');
  }

  const cookieValue = cookieStore.get(STATE_COOKIE_NAME)?.value;
  const receivedState = url.searchParams.get('state');
  if (
    !isMatchingOAuthState(
      cookieValue,
      receivedState,
      `${user.uid}:${workspace.workspaceId}`,
    )
  ) {
    return redirectToSettings(request, 'invalid-state');
  }

  if (url.searchParams.has('error')) {
    return redirectToSettings(request, 'cancelled');
  }

  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) {
    return redirectToSettings(request, 'connection-error');
  }

  try {
    const config = getInstagramOAuthConfig();
    assertSocialTokenEncryptionConfigured();
    const accounts = await exchangeInstagramAuthorizationCodeForAccounts(
      config,
      code,
    );
    const tokenIssuedAt = new Date();
    for (const account of accounts) {
      await saveInstagramAccount(workspace.workspaceId, user.uid, {
        ...account,
        tokenIssuedAt,
      });
    }
    return redirectToSettings(request, 'connected');
  } catch (error) {
    if (error instanceof InstagramOAuthConfigurationError) {
      return redirectToSettings(request, 'configuration');
    }
    if (error instanceof AccountStorageUnavailableError) {
      return redirectToSettings(request, 'storage-required');
    }
    if (error instanceof InstagramOAuthProviderError) {
      console.error('A conexão com o Instagram não foi concluída:', error.message);
      return redirectToSettings(
        request,
        error.message.includes('permissões') ? 'permission-required' : 'connection-error',
      );
    }
    if (getProviderErrorCode(error)?.startsWith('auth/')) {
      return redirectToSettings(request, 'login-required');
    }
    console.error('Erro ao finalizar OAuth do Instagram:', error);
    return redirectToSettings(request, 'connection-error');
  }
}
