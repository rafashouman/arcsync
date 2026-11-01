import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/src/libs/authSession';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { canManageWorkspace } from '@/src/libs/workspacePermissions';
import { AccountStorageUnavailableError } from '@/src/data/accounts';
import { listSocialAccountsForWorkspace } from '@/src/data/socialAccounts';
import { assertSocialTokenEncryptionConfigured } from '@/src/libs/socialTokenCrypto';
import {
  createTikTokAuthorizationUrl,
  getTikTokOAuthConfig,
} from '@/src/libs/tiktokOAuth';
import { SocialOAuthConfigurationError } from '@/src/libs/socialOAuth';

const STATE_COOKIE_NAME = 'feedsync_tiktok_oauth_state';
const STATE_COOKIE_PATH = '/api/social/tiktok';
const STATE_MAX_AGE_SECONDS = 10 * 60;

function redirectToSettings(request: Request, status: string) {
  return NextResponse.redirect(
    new URL(`/settings/accounts?social=${encodeURIComponent(status)}`, request.url),
  );
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));
  if (!process.env.MONGODB_URI) return redirectToSettings(request, 'storage-required');

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canManageWorkspace(workspace.role)) {
      return redirectToSettings(request, 'permission-required');
    }
    const config = getTikTokOAuthConfig();
    assertSocialTokenEncryptionConfigured();
    await listSocialAccountsForWorkspace(workspace.workspaceId, 'tiktok');

    const state = randomBytes(32).toString('base64url');
    const response = NextResponse.redirect(
      createTikTokAuthorizationUrl(config, state),
    );
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
    if (error instanceof SocialOAuthConfigurationError) {
      return redirectToSettings(request, 'tiktok-configuration');
    }
    if (error instanceof AccountStorageUnavailableError) {
      return redirectToSettings(request, 'storage-required');
    }
    console.error('Não foi possível iniciar o OAuth do TikTok:', error);
    return redirectToSettings(request, 'tiktok-connection-error');
  }
}
