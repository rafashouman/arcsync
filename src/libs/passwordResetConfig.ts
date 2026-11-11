export interface SmtpConfiguration {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export function getSmtpConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): SmtpConfiguration | null {
  const host = env.SMTP_HOST?.trim();
  const port = Number(env.SMTP_PORT);
  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD;
  const from = env.SMTP_FROM?.trim();
  let isValidHost = false;
  if (host) {
    try {
      const parsedHost = new URL(`smtp://${host}`);
      isValidHost =
        Boolean(parsedHost.hostname) &&
        !parsedHost.username &&
        !parsedHost.password &&
        !parsedHost.port &&
        (parsedHost.pathname === '' || parsedHost.pathname === '/') &&
        !parsedHost.search &&
        !parsedHost.hash;
    } catch {
      isValidHost = false;
    }
  }
  if (
    !host ||
    !isValidHost ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    !user ||
    !password ||
    !from ||
    /[\r\n]/.test(from)
  ) {
    return null;
  }
  return { host, port, user, password, from };
}

export function getPasswordResetUrl(
  token: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return getPublicAppUrl(`/reset-password?token=${encodeURIComponent(token)}`, env);
}

export function getEmailVerificationUrl(
  token: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return getPublicAppUrl(`/verify-email?token=${encodeURIComponent(token)}`, env);
}

function getPublicAppUrl(path: string, env: NodeJS.ProcessEnv) {
  const rawBaseUrl = env.PUBLIC_APP_URL?.trim();
  if (
    !rawBaseUrl ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\')
  ) {
    return null;
  }
  try {
    const baseUrl = new URL(rawBaseUrl);
    const isLocalDevelopment =
      env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname);
    if (
      (baseUrl.protocol !== 'https:' && !isLocalDevelopment) ||
      baseUrl.username ||
      baseUrl.password
    ) {
      return null;
    }

    return new URL(path, baseUrl.origin).toString();
  } catch {
    return null;
  }
}
