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

const REQUIRED_SCOPES = ['user.info.basic', 'video.publish'] as const;
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

export interface TikTokOAuthConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TikTokCreatorInfo {
  creatorNickname: string;
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSeconds: number;
}

export function getTikTokOAuthConfig(): TikTokOAuthConfig {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  if (!clientKey || !clientSecret || !redirectUri) {
    throw new SocialOAuthConfigurationError(
      'Configure TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET e TIKTOK_REDIRECT_URI.',
    );
  }
  assertRedirectUri(
    redirectUri,
    '/api/social/tiktok/callback',
    'TIKTOK_REDIRECT_URI',
    false,
  );
  return { clientKey, clientSecret, redirectUri };
}

export function createTikTokAuthorizationUrl(
  config: TikTokOAuthConfig,
  state: string,
) {
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.searchParams.set('client_key', config.clientKey);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', REQUIRED_SCOPES.join(','));
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  return url;
}

export async function queryTikTokCreatorInfo(
  accessToken: string,
): Promise<TikTokCreatorInfo> {
  const result = await requestJson(
    'TikTok',
    new URL('https://open.tiktokapis.com/v2/post/publish/creator_info/query/'),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: '{}',
    },
  );
  const body = isRecord(result.body) ? result.body : null;
  const data = body && isRecord(body.data) ? body.data : null;
  const privacyLevels = data?.privacy_level_options;
  if (
    !result.ok ||
    !body ||
    !isRecord(body.error) ||
    body.error.code !== 'ok' ||
    !data ||
    typeof data.creator_nickname !== 'string' ||
    !Array.isArray(privacyLevels) ||
    typeof data.comment_disabled !== 'boolean' ||
    typeof data.duet_disabled !== 'boolean' ||
    typeof data.stitch_disabled !== 'boolean' ||
    typeof data.max_video_post_duration_sec !== 'number' ||
    !Number.isSafeInteger(data.max_video_post_duration_sec) ||
    data.max_video_post_duration_sec < 1
  ) {
    throw new SocialOAuthProviderError(
      'Não foi possível consultar as opções atuais de publicação da conta TikTok.',
    );
  }
  return {
    creatorNickname: data.creator_nickname,
    privacyLevelOptions: privacyLevels.filter(
      (level): level is string => typeof level === 'string',
    ),
    commentDisabled: data.comment_disabled,
    duetDisabled: data.duet_disabled,
    stitchDisabled: data.stitch_disabled,
    maxVideoPostDurationSeconds: data.max_video_post_duration_sec,
  };
}

function parseTokenResponse(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.access_token !== 'string' ||
    !value.access_token ||
    typeof value.refresh_token !== 'string' ||
    !value.refresh_token ||
    typeof value.expires_in !== 'number' ||
    value.expires_in <= 0 ||
    typeof value.open_id !== 'string'
  ) {
    throw new SocialOAuthProviderError(
      'O TikTok retornou uma resposta de token inválida.',
    );
  }

  const now = Date.now();
  const tokens: OAuthTokenSet = {
    accessToken: value.access_token,
    accessTokenExpiresAt: new Date(now + value.expires_in * 1000),
    refreshToken: value.refresh_token,
    refreshTokenExpiresAt:
      typeof value.refresh_expires_in === 'number' && value.refresh_expires_in > 0
        ? new Date(now + value.refresh_expires_in * 1000)
        : null,
  };
  return {
    tokens,
    openId: value.open_id,
    scopes: parseScopes(value.scope, /,/),
  };
}

async function getDisplayName(accessToken: string) {
  const url = new URL('https://open.tiktokapis.com/v2/user/info/');
  url.searchParams.set('fields', 'open_id,display_name');
  try {
    const result = await requestJson('TikTok', url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (
      result.ok &&
      isRecord(result.body) &&
      isRecord(result.body.data) &&
      isRecord(result.body.data.user) &&
      typeof result.body.data.user.display_name === 'string' &&
      result.body.data.user.display_name
    ) {
      return result.body.data.user.display_name;
    }
  } catch {
    return null;
  }
  return null;
}

export async function exchangeTikTokAuthorizationCode(
  config: TikTokOAuthConfig,
  code: string,
): Promise<ConnectedSocialAccount> {
  const { tokens, openId, scopes } = parseTokenResponse(
    await postForm('TikTok', new URL(TOKEN_URL), {
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  );

  const missing = REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
  if (missing.length > 0) {
    throw new SocialOAuthProviderError(
      'O acesso foi concedido sem as permissões necessárias para publicar. Reconecte e aceite todas.',
    );
  }

  return {
    ...tokens,
    platformAccountId: openId,
    accountName: (await getDisplayName(tokens.accessToken)) ?? 'Conta TikTok',
    permissions: scopes,
  };
}

export async function refreshTikTokTokens(
  config: TikTokOAuthConfig,
  refreshToken: string,
): Promise<OAuthTokenSet> {
  const { tokens } = parseTokenResponse(
    await postForm('TikTok', new URL(TOKEN_URL), {
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  );
  return tokens;
}

export async function revokeTikTokToken(
  config: TikTokOAuthConfig,
  token: string,
) {
  try {
    await requestJson('TikTok', new URL('https://open.tiktokapis.com/v2/oauth/revoke/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: config.clientKey,
        client_secret: config.clientSecret,
        token,
      }),
    });
  } catch {
    // A conta local é removida mesmo se a revogação remota falhar.
  }
}
