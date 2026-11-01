import 'server-only';

export interface OAuthTokenSet {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date | null;
}

export interface ConnectedSocialAccount extends OAuthTokenSet {
  platformAccountId: string;
  accountName: string;
  permissions: string[];
}

export class SocialOAuthConfigurationError extends Error {
  constructor(message = 'Configure as credenciais OAuth da rede no servidor.') {
    super(message);
    this.name = 'SocialOAuthConfigurationError';
  }
}

export class SocialOAuthProviderError extends Error {
  constructor(message = 'A plataforma não concluiu a conexão da conta.') {
    super(message);
    this.name = 'SocialOAuthProviderError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function assertRedirectUri(
  value: string,
  expectedPath: string,
  envName: string,
  allowLocalHttp: boolean,
) {
  let redirect: URL;
  try {
    redirect = new URL(value);
  } catch {
    throw new SocialOAuthConfigurationError(`${envName} deve ser uma URL válida.`);
  }

  const isLocalHost = ['localhost', '127.0.0.1'].includes(redirect.hostname);
  const protocolAllowed =
    redirect.protocol === 'https:' ||
    (allowLocalHttp && isLocalHost && redirect.protocol === 'http:');
  if (
    !protocolAllowed ||
    redirect.pathname !== expectedPath ||
    redirect.search ||
    redirect.hash ||
    redirect.username ||
    redirect.password
  ) {
    throw new SocialOAuthConfigurationError(
      `${envName} deve apontar para ${expectedPath} usando HTTPS.`,
    );
  }
}

export async function requestJson(
  label: string,
  url: URL,
  init: RequestInit,
): Promise<{ status: number; ok: boolean; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SocialOAuthProviderError(
      `Não foi possível acessar a API do ${label}. Tente novamente.`,
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, ok: response.ok, body };
}

export async function postForm(
  label: string,
  url: URL,
  fields: Record<string, string>,
) {
  const result = await requestJson(label, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  if (!result.ok || (isRecord(result.body) && typeof result.body.error === 'string')) {
    const reason =
      isRecord(result.body) && typeof result.body.error === 'string'
        ? result.body.error
        : `HTTP ${result.status}`;
    console.error(`O ${label} recusou a solicitação de token:`, reason);
    throw new SocialOAuthProviderError();
  }
  return result.body;
}

export function parseScopes(value: unknown, separator: RegExp) {
  return typeof value === 'string'
    ? value.split(separator).map((scope) => scope.trim()).filter(Boolean)
    : [];
}
