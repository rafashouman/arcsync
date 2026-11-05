import 'server-only';

const FACEBOOK_LOGIN_INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
] as const;

const LEGACY_INSTAGRAM_LOGIN_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
] as const;

const DEFAULT_GRAPH_API_VERSION = 'v26.0';
const SIXTY_DAYS_SECONDS = 60 * 24 * 60 * 60;

export interface InstagramOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  graphApiVersion: string;
  configId?: string;
  loginMode: 'facebook' | 'instagram';
}

interface InstagramTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in: number;
  user_id?: string | number;
  permissions?: string | string[];
}

interface InstagramProfileResponse {
  user_id?: string | number;
  id?: string | number;
  username: string;
  account_type?: string;
}

export interface ConnectedInstagramAccount {
  platformAccountId: string;
  accountName: string;
  accessToken: string;
  expiresAt: Date;
  permissions: string[];
}

export class InstagramOAuthConfigurationError extends Error {
  constructor(message = 'Configure as credenciais do Instagram/Meta Login no servidor.') {
    super(message);
    this.name = 'InstagramOAuthConfigurationError';
  }
}

export class InstagramOAuthProviderError extends Error {
  constructor(message = 'A Meta não concluiu a conexão com o Instagram.') {
    super(message);
    this.name = 'InstagramOAuthProviderError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isInstagramProfileResponse(
  value: unknown,
): value is InstagramProfileResponse {
  return (
    isRecord(value) &&
    (typeof value.user_id === 'string' ||
      typeof value.user_id === 'number' ||
      typeof value.id === 'string' ||
      typeof value.id === 'number') &&
    typeof value.username === 'string' &&
    value.username.length > 0
  );
}

function parseTokenResponse(
  value: unknown,
  allowDefaultExpiry = false,
): InstagramTokenResponse {
  if (
    !isRecord(value) ||
    typeof value.access_token !== 'string' ||
    !value.access_token
  ) {
    throw new InstagramOAuthProviderError(
      'A Meta retornou uma resposta de token inválida.',
    );
  }

  const rawExpiresIn = value.expires_in;
  const expiresIn =
    typeof rawExpiresIn === 'number' &&
    Number.isFinite(rawExpiresIn) &&
    rawExpiresIn > 0
      ? rawExpiresIn
      : allowDefaultExpiry
        ? SIXTY_DAYS_SECONDS
        : NaN;

  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new InstagramOAuthProviderError(
      'A Meta retornou uma resposta de token inválida.',
    );
  }

  const permissions = value.permissions;
  if (
    permissions !== undefined &&
    typeof permissions !== 'string' &&
    !(
      Array.isArray(permissions) &&
      permissions.every((permission) => typeof permission === 'string')
    )
  ) {
    throw new InstagramOAuthProviderError(
      'A Meta retornou permissões em formato inválido.',
    );
  }

  return {
    access_token: value.access_token,
    token_type:
      typeof value.token_type === 'string' ? value.token_type : undefined,
    expires_in: expiresIn,
    user_id:
      typeof value.user_id === 'string' || typeof value.user_id === 'number'
        ? value.user_id
        : undefined,
    permissions: permissions as string | string[] | undefined,
  };
}

async function getJson(
  url: URL,
  init?: RequestInit,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error('Falha de rede ao falar com a API do Instagram/Meta:', error);
    throw new InstagramOAuthProviderError(
      'Não foi possível acessar a API da Meta. Tente novamente.',
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new InstagramOAuthProviderError(
      'A API da Meta retornou uma resposta inválida.',
    );
  }

  if (!response.ok) {
    const errorCode =
      isRecord(body) && isRecord(body.error) && typeof body.error.code === 'number'
        ? body.error.code
        : response.status;
    console.error('A API da Meta recusou a solicitação:', {
      status: response.status,
      code: errorCode,
    });
    throw new InstagramOAuthProviderError();
  }

  return body;
}

export function getInstagramOAuthConfig(): InstagramOAuthConfig {
  const clientId =
    process.env.INSTAGRAM_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim();
  const clientSecret =
    process.env.INSTAGRAM_APP_SECRET?.trim() ||
    process.env.FACEBOOK_APP_SECRET?.trim();
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI?.trim();
  const graphApiVersion =
    process.env.INSTAGRAM_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;
  const configId = process.env.INSTAGRAM_CONFIG_ID?.trim() || undefined;
  const loginMode =
    process.env.INSTAGRAM_LOGIN_MODE?.trim() === 'instagram'
      ? 'instagram'
      : 'facebook';

  if (!clientId || !clientSecret || !redirectUri) {
    throw new InstagramOAuthConfigurationError();
  }

  let redirect: URL;
  try {
    redirect = new URL(redirectUri);
  } catch {
    throw new InstagramOAuthConfigurationError(
      'INSTAGRAM_REDIRECT_URI deve ser uma URL válida.',
    );
  }

  const isLocalHost = ['localhost', '127.0.0.1'].includes(redirect.hostname);
  if (
    (redirect.protocol !== 'https:' && !(isLocalHost && redirect.protocol === 'http:')) ||
    redirect.pathname !== '/api/social/meta/callback' ||
    redirect.search ||
    redirect.hash
  ) {
    throw new InstagramOAuthConfigurationError(
      'INSTAGRAM_REDIRECT_URI deve apontar para /api/social/meta/callback usando HTTPS.',
    );
  }

  if (!/^v\d+\.\d+$/.test(graphApiVersion)) {
    throw new InstagramOAuthConfigurationError(
      'INSTAGRAM_GRAPH_API_VERSION deve usar o formato vNN.0.',
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    graphApiVersion,
    configId,
    loginMode,
  };
}

export function createInstagramAuthorizationUrl(
  config: InstagramOAuthConfig,
  state: string,
) {
  if (config.loginMode === 'instagram') {
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', LEGACY_INSTAGRAM_LOGIN_SCOPES.join(','));
    url.searchParams.set('state', state);
    return url;
  }

  const url = new URL(
    `https://www.facebook.com/${config.graphApiVersion}/dialog/oauth`,
  );
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  if (config.configId) {
    url.searchParams.set('config_id', config.configId);
  } else {
    url.searchParams.set('scope', FACEBOOK_LOGIN_INSTAGRAM_SCOPES.join(','));
  }
  return url;
}

async function discoverFacebookGraphInstagramAccounts(
  config: InstagramOAuthConfig,
  accessToken: string,
  expiresAt: Date,
  fetcher: typeof fetch,
): Promise<ConnectedInstagramAccount[]> {
  const discovered = new Map<string, ConnectedInstagramAccount>();
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  // 1. Check granted permissions if available
  let permissions: string[] = [...FACEBOOK_LOGIN_INSTAGRAM_SCOPES];
  try {
    const permUrl = new URL(
      `https://graph.facebook.com/${config.graphApiVersion}/me/permissions`,
    );
    const permBody = await getJson(permUrl, { headers: authHeader }, fetcher);
    if (isRecord(permBody) && Array.isArray(permBody.data)) {
      const granted = permBody.data
        .filter(
          (item): item is Record<string, unknown> =>
            isRecord(item) &&
            typeof item.permission === 'string' &&
            item.status === 'granted',
        )
        .map((item) => String(item.permission));
      if (granted.length > 0) {
        permissions = granted;
      }
    }
  } catch {
    // System User Access Tokens from Unified Login may not expose /me/permissions.
  }

  // 2. Discover via /me/accounts (Facebook Login & Unified Login with linked Page)
  try {
    const pagesUrl = new URL(
      `https://graph.facebook.com/${config.graphApiVersion}/me/accounts`,
    );
    pagesUrl.searchParams.set(
      'fields',
      'id,name,instagram_business_account{id,username}',
    );
    pagesUrl.searchParams.set('limit', '100');
    const pagesBody = await getJson(pagesUrl, { headers: authHeader }, fetcher);
    if (isRecord(pagesBody) && Array.isArray(pagesBody.data)) {
      for (const page of pagesBody.data) {
        if (!isRecord(page)) continue;
        const ig = page.instagram_business_account;
        if (
          isRecord(ig) &&
          typeof ig.id === 'string' &&
          /^\d+$/.test(ig.id) &&
          typeof ig.username === 'string' &&
          ig.username.length > 0
        ) {
          discovered.set(ig.id, {
            platformAccountId: ig.id,
            accountName: ig.username,
            accessToken,
            expiresAt,
            permissions,
          });
        }
      }
    }
  } catch {
    // Continue to Unified Login direct endpoints if /me/accounts fails
  }

  // 3. Discover via /me/assigned_instagram_accounts or /me/instagram_accounts (Unified Login without Facebook Page)
  if (discovered.size === 0) {
    for (const edge of ['me/assigned_instagram_accounts', 'me/instagram_accounts']) {
      try {
        const igUrl = new URL(
          `https://graph.facebook.com/${config.graphApiVersion}/${edge}`,
        );
        igUrl.searchParams.set('fields', 'id,username');
        igUrl.searchParams.set('limit', '100');
        const igBody = await getJson(igUrl, { headers: authHeader }, fetcher);
        if (isRecord(igBody) && Array.isArray(igBody.data)) {
          for (const ig of igBody.data) {
            if (
              isRecord(ig) &&
              typeof ig.id === 'string' &&
              /^\d+$/.test(ig.id) &&
              typeof ig.username === 'string' &&
              ig.username.length > 0
            ) {
              discovered.set(ig.id, {
                platformAccountId: ig.id,
                accountName: ig.username,
                accessToken,
                expiresAt,
                permissions,
              });
            }
          }
        }
        if (discovered.size > 0) break;
      } catch {
        // Ignore unsupported edge and try next
      }
    }
  }

  if (discovered.size === 0) {
    throw new InstagramOAuthProviderError(
      'Nenhuma conta profissional do Instagram foi encontrada na autorização da Meta. Certifique-se de selecionar a conta do Instagram (e a Página/Portfólio vinculado) ao autorizar.',
    );
  }

  return Array.from(discovered.values());
}

export async function exchangeInstagramAuthorizationCodeForAccounts(
  config: InstagramOAuthConfig,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<ConnectedInstagramAccount[]> {
  if (config.loginMode === 'instagram') {
    const formData = new FormData();
    formData.set('client_id', config.clientId);
    formData.set('client_secret', config.clientSecret);
    formData.set('grant_type', 'authorization_code');
    formData.set('redirect_uri', config.redirectUri);
    formData.set('code', code);

    const shortLivedToken = parseTokenResponse(
      await getJson(
        new URL('https://api.instagram.com/oauth/access_token'),
        { method: 'POST', body: formData },
        fetcher,
      ),
    );
    const permissions =
      typeof shortLivedToken.permissions === 'string'
        ? shortLivedToken.permissions.split(',').map((value) => value.trim())
        : shortLivedToken.permissions ?? [];
    const missingPermissions = LEGACY_INSTAGRAM_LOGIN_SCOPES.filter(
      (permission) => !permissions.includes(permission),
    );
    if (missingPermissions.length > 0) {
      throw new InstagramOAuthProviderError(
        'O acesso foi concedido sem as permissões básicas e de publicação necessárias. Reconecte a conta e aceite ambas.',
      );
    }

    const longLivedUrl = new URL('https://graph.instagram.com/access_token');
    longLivedUrl.searchParams.set('grant_type', 'ig_exchange_token');
    longLivedUrl.searchParams.set('client_secret', config.clientSecret);
    longLivedUrl.searchParams.set('access_token', shortLivedToken.access_token);
    const longLivedToken = parseTokenResponse(
      await getJson(longLivedUrl, undefined, fetcher),
    );

    const profileUrl = new URL(
      `https://graph.instagram.com/${config.graphApiVersion}/me`,
    );
    profileUrl.searchParams.set('fields', 'user_id,username,account_type');
    profileUrl.searchParams.set('access_token', longLivedToken.access_token);
    const profileValue = await getJson(profileUrl, undefined, fetcher);
    if (!isInstagramProfileResponse(profileValue)) {
      throw new InstagramOAuthProviderError(
        'Não foi possível identificar a conta profissional do Instagram.',
      );
    }

    return [
      {
        platformAccountId: String(profileValue.user_id ?? profileValue.id),
        accountName: profileValue.username,
        accessToken: longLivedToken.access_token,
        expiresAt: new Date(Date.now() + longLivedToken.expires_in * 1000),
        permissions,
      },
    ];
  }

  // Unified Login / Facebook Login flow via graph.facebook.com
  const tokenUrl = new URL(
    `https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`,
  );
  tokenUrl.searchParams.set('client_id', config.clientId);
  tokenUrl.searchParams.set('client_secret', config.clientSecret);
  tokenUrl.searchParams.set('redirect_uri', config.redirectUri);
  tokenUrl.searchParams.set('code', code);

  const initialToken = parseTokenResponse(
    await getJson(tokenUrl, undefined, fetcher),
    true,
  );

  let finalToken = initialToken;
  try {
    const exchangeUrl = new URL(
      `https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`,
    );
    exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
    exchangeUrl.searchParams.set('client_id', config.clientId);
    exchangeUrl.searchParams.set('client_secret', config.clientSecret);
    exchangeUrl.searchParams.set('fb_exchange_token', initialToken.access_token);
    finalToken = parseTokenResponse(
      await getJson(exchangeUrl, undefined, fetcher),
      true,
    );
  } catch {
    // Unified Login SUAT tokens may already be long-lived and not support fb_exchange_token.
  }

  const expiresAt = new Date(Date.now() + finalToken.expires_in * 1000);
  return discoverFacebookGraphInstagramAccounts(
    config,
    finalToken.access_token,
    expiresAt,
    fetcher,
  );
}

export async function exchangeInstagramAuthorizationCode(
  config: InstagramOAuthConfig,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<ConnectedInstagramAccount> {
  const accounts = await exchangeInstagramAuthorizationCodeForAccounts(
    config,
    code,
    fetcher,
  );
  return accounts[0];
}

export async function refreshInstagramLongLivedToken(
  config: InstagramOAuthConfig,
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  if (config.loginMode === 'instagram' || accessToken.startsWith('IG')) {
    const url = new URL('https://graph.instagram.com/refresh_access_token');
    url.searchParams.set('grant_type', 'ig_refresh_token');
    url.searchParams.set('access_token', accessToken);
    return parseTokenResponse(await getJson(url, undefined, fetcher));
  }

  const url = new URL(
    `https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`,
  );
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('client_secret', config.clientSecret);
  url.searchParams.set('fb_exchange_token', accessToken);
  return parseTokenResponse(await getJson(url, undefined, fetcher), true);
}

export function getRequiredInstagramPermissions() {
  return [...FACEBOOK_LOGIN_INSTAGRAM_SCOPES];
}
