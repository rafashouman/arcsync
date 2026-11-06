import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { publicUrl } from '@/src/libs/publicUrl';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { canManageWorkspace } from '@/src/libs/workspacePermissions';
import {
  AccountStorageUnavailableError,
  listInstagramAccountsForWorkspace,
} from '@/src/data/accounts';
import {
  assertSocialTokenEncryptionConfigured,
} from '@/src/libs/socialTokenCrypto';
import {
  createInstagramAuthorizationUrl,
  getInstagramOAuthConfig,
  InstagramOAuthConfigurationError,
} from '@/src/libs/instagramOAuth';

const STATE_COOKIE_NAME = 'feedsync_meta_oauth_state';
const STATE_COOKIE_PATH = '/api/social/meta';
const STATE_MAX_AGE_SECONDS = 10 * 60;

function redirectToSettings(request: Request, status: string) {
  return NextResponse.redirect(
    publicUrl(
      `/settings/accounts?meta=${encodeURIComponent(status)}`,
      request,
    ),
  );
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(publicUrl('/login', request));
  }

  if (!process.env.MONGODB_URI) {
    return redirectToSettings(request, 'storage-required');
  }

  let authorizationUrl: URL;
  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canManageWorkspace(workspace.role)) {
      return redirectToSettings(request, 'permission-required');
    }
    const config = getInstagramOAuthConfig();
    assertSocialTokenEncryptionConfigured();
    await listInstagramAccountsForWorkspace(workspace.workspaceId);
    const state = randomBytes(32).toString('base64url');
    authorizationUrl = createInstagramAuthorizationUrl(config, state);

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(
      STATE_COOKIE_NAME,
      `${state}.${user.uid}:${workspace.workspaceId}`,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: STATE_COOKIE_PATH,
        maxAge: STATE_MAX_AGE_SECONDS,
      },
    );
    return response;
  } catch (error) {
    if (error instanceof InstagramOAuthConfigurationError) {
      return redirectToSettings(request, 'configuration');
    }
    if (error instanceof AccountStorageUnavailableError) {
      return redirectToSettings(request, 'storage-required');
    }
    console.error('Não foi possível iniciar o OAuth do Instagram:', error);
    return redirectToSettings(request, 'connection-error');
  }
}
