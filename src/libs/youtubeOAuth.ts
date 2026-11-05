import 'server-only';

import {
  assertRedirectUri,
  isRecord,
  parseScopes,
  postForm,
  requestJson,
  SocialOAuthConfigurationError,
  SocialOAuthProviderError,
  type ConnectedSocialAccount,
  type OAuthTokenSet,
} from '@/src/libs/socialOAuth';

const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
export const YOUTUBE_READONLY_SCOPE =
  'https://www.googleapis.com/auth/youtube.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface YouTubeOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getYouTubeOAuthConfig(): YouTubeOAuthConfig {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new SocialOAuthConfigurationError(
      'Configure YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET e YOUTUBE_REDIRECT_URI.',
    );
  }
  assertRedirectUri(
    redirectUri,
    '/api/social/youtube/callback',
    'YOUTUBE_REDIRECT_URI',
    true,
  );
  return { clientId, clientSecret, redirectUri };
}

export function createYouTubeAuthorizationUrl(
  config: YouTubeOAuthConfig,
  state: string,
) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', [UPLOAD_SCOPE, YOUTUBE_READONLY_SCOPE].join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url;
}

function parseAccessToken(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.access_token !== 'string' ||
    !value.access_token ||
    typeof value.expires_in !== 'number' ||
    value.expires_in <= 0
  ) {
    throw new SocialOAuthProviderError(
      'O Google retornou uma resposta de token inválida.',
    );
  }
  return {
    accessToken: value.access_token,
    accessTokenExpiresAt: new Date(Date.now() + value.expires_in * 1000),
    refreshToken:
      typeof value.refresh_token === 'string' && value.refresh_token
        ? value.refresh_token
        : null,
    scopes: parseScopes(value.scope, /\s+/),
  };
}

async function getChannel(accessToken: string) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('mine', 'true');
  const result = await requestJson('YouTube', url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!result.ok) {
    console.error('A API do YouTube recusou a consulta do canal:', {
      status: result.status,
      body: result.body,
    });
  }
  const channel =
    result.ok &&
    isRecord(result.body) &&
    Array.isArray(result.body.items) &&
    isRecord(result.body.items[0])
      ? result.body.items[0]
      : null;
  if (
    !channel ||
    typeof channel.id !== 'string' ||
    !isRecord(channel.snippet) ||
    typeof channel.snippet.title !== 'string'
  ) {
    throw new SocialOAuthProviderError(
      'Não encontramos um canal do YouTube nesta conta Google.',
    );
  }
  return { id: channel.id, title: channel.snippet.title };
}

export async function exchangeYouTubeAuthorizationCode(
  config: YouTubeOAuthConfig,
  code: string,
): Promise<ConnectedSocialAccount> {
  const token = parseAccessToken(
    await postForm('Google', new URL(TOKEN_URL), {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  );

  if (!token.scopes.includes(UPLOAD_SCOPE) || !token.refreshToken) {
    throw new SocialOAuthProviderError(
      'O acesso foi concedido sem a permissão de envio de vídeos. Reconecte e aceite todas as permissões.',
    );
  }

  const channel = await getChannel(token.accessToken);
  return {
    accessToken: token.accessToken,
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    refreshToken: token.refreshToken,
    refreshTokenExpiresAt: null,
    platformAccountId: channel.id,
    accountName: channel.title,
    permissions: token.scopes,
  };
}

export async function refreshYouTubeTokens(
  config: YouTubeOAuthConfig,
  refreshToken: string,
): Promise<OAuthTokenSet> {
  const token = parseAccessToken(
    await postForm('Google', new URL(TOKEN_URL), {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  );
  return {
    accessToken: token.accessToken,
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    refreshToken: token.refreshToken ?? refreshToken,
    refreshTokenExpiresAt: null,
  };
}

export async function revokeYouTubeToken(token: string) {
  try {
    await requestJson('Google', new URL('https://oauth2.googleapis.com/revoke'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // A conta local é removida mesmo se a revogação remota falhar.
  }
}
