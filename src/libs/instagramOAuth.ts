import 'server-only';

const REQUIRED_PERMISSIONS = [
  'instagram_business_basic',
  'instagram_business_content_publish',
] as const;
const DEFAULT_GRAPH_API_VERSION = 'v26.0';

interface InstagramOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  graphApiVersion: string;
}

interface InstagramTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in: number;
  user_id?: string | number;
  permissions?: string | string[];
}

interface InstagramProfileResponse {
  user_id: string | number;
  username: string;
  account_type?: string;
}

export class InstagramOAuthConfigurationError extends Error {
  constructor(message = 'Configure as credenciais do Instagram Login no servidor.') {
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
      typeof value.user_id === 'number') &&
    typeof value.username === 'string' &&
    value.username.length > 0
  );
}

function parseTokenResponse(value: unknown): InstagramTokenResponse {
  if (
    !isRecord(value) ||
    typeof value.access_token !== 'string' ||
    !value.access_token ||
    typeof value.expires_in !== 'number' ||
    !Number.isFinite(value.expires_in) ||
    value.expires_in <= 0
  ) {
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
    expires_in: value.expires_in,
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
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error('Falha de rede ao falar com a API do Instagram:', error);
    throw new InstagramOAuthProviderError(
      'Não foi possível acessar a API do Instagram. Tente novamente.',
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new InstagramOAuthProviderError(
      'A API do Instagram retornou uma resposta inválida.',
    );
  }

  if (!response.ok) {
    const errorCode =
      isRecord(body) && isRecord(body.error) && typeof body.error.code === 'number'
        ? body.error.code
        : response.status;
    console.error('A API do Instagram recusou a solicitação:', {
      status: response.status,
      code: errorCode,
    });
    throw new InstagramOAuthProviderError();
  }

  return body;
}

export function getInstagramOAuthConfig(): InstagramOAuthConfig {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  const graphApiVersion =
    process.env.INSTAGRAM_GRAPH_API_VERSION ?? DEFAULT_GRAPH_API_VERSION;

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

  return { clientId, clientSecret, redirectUri, graphApiVersion };
}

export function createInstagramAuthorizationUrl(
  config: InstagramOAuthConfig,
  state: string,
) {
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', REQUIRED_PERMISSIONS.join(','));
  url.searchParams.set('state', state);
  return url;
}

export async function exchangeInstagramAuthorizationCode(
  config: InstagramOAuthConfig,
  code: string,
) {
  const formData = new FormData();
  formData.set('client_id', config.clientId);
  formData.set('client_secret', config.clientSecret);
  formData.set('grant_type', 'authorization_code');
  formData.set('redirect_uri', config.redirectUri);
  formData.set('code', code);

  const shortLivedToken = parseTokenResponse(
    await getJson(new URL('https://api.instagram.com/oauth/access_token'), {
      method: 'POST',
      body: formData,
    }),
  );
  const permissions =
    typeof shortLivedToken.permissions === 'string'
      ? shortLivedToken.permissions.split(',').map((value) => value.trim())
      : shortLivedToken.permissions ?? [];
  const missingPermissions = REQUIRED_PERMISSIONS.filter(
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
  const longLivedToken = parseTokenResponse(await getJson(longLivedUrl));

  const profileUrl = new URL(
    `https://graph.instagram.com/${config.graphApiVersion}/me`,
  );
  profileUrl.searchParams.set('fields', 'user_id,username,account_type');
  profileUrl.searchParams.set('access_token', longLivedToken.access_token);
  const profileValue = await getJson(profileUrl);
  if (!isInstagramProfileResponse(profileValue)) {
    throw new InstagramOAuthProviderError(
      'Não foi possível identificar a conta profissional do Instagram.',
    );
  }

  return {
    platformAccountId: String(profileValue.user_id),
    accountName: profileValue.username,
    accessToken: longLivedToken.access_token,
    expiresAt: new Date(Date.now() + longLivedToken.expires_in * 1000),
    permissions,
  };
}

export async function refreshInstagramLongLivedToken(
  config: InstagramOAuthConfig,
  accessToken: string,
) {
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', accessToken);
  return parseTokenResponse(await getJson(url));
}

export function getRequiredInstagramPermissions() {
  return [...REQUIRED_PERMISSIONS];
}
