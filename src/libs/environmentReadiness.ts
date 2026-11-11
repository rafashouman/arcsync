import path from 'path';
import { getSmtpConfiguration } from '@/src/libs/passwordResetConfig';

export interface ReadinessCheck {
  level: 'error' | 'warning';
  key: string;
  message: string;
}

interface OAuthProviderConfiguration {
  prefix: string;
  requiredKeys: string[];
  redirectKey: string;
  redirectPath: string;
  allowLocalHttp: boolean;
}

const oauthProviders: OAuthProviderConfiguration[] = [
  {
    prefix: 'Facebook', requiredKeys: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    redirectKey: 'FACEBOOK_REDIRECT_URI', redirectPath: '/api/social/facebook/callback', allowLocalHttp: true,
  },
  {
    prefix: 'Instagram',
    requiredKeys: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'],
    redirectKey: 'INSTAGRAM_REDIRECT_URI',
    redirectPath: '/api/social/meta/callback',
    allowLocalHttp: true,
  },
  {
    prefix: 'TikTok',
    requiredKeys: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
    redirectKey: 'TIKTOK_REDIRECT_URI',
    redirectPath: '/api/social/tiktok/callback',
    allowLocalHttp: false,
  },
  {
    prefix: 'YouTube',
    requiredKeys: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
    redirectKey: 'YOUTUBE_REDIRECT_URI',
    redirectPath: '/api/social/youtube/callback',
    allowLocalHttp: true,
  },
];

function isValidApplicationUrl(value: string, production: boolean) {
  try {
    const url = new URL(value);
    const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(
      url.hostname,
    );
    return (
      (url.protocol === 'https:' ||
        (!production && isLocalHost && url.protocol === 'http:')) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function isValidMongoUri(value: string) {
  try {
    const uri = new URL(value);
    return (
      (uri.protocol === 'mongodb:' || uri.protocol === 'mongodb+srv:') &&
      Boolean(uri.hostname)
    );
  } catch {
    return false;
  }
}

function isValidBase64Key(value: string) {
  return Buffer.from(value, 'base64').length === 32;
}

function validateOAuthProvider(
  env: NodeJS.ProcessEnv,
  provider: OAuthProviderConfiguration,
  production: boolean,
): ReadinessCheck | null {
  const keys = [...provider.requiredKeys, provider.redirectKey];
  const configured = keys.filter((key) => Boolean(env[key]?.trim()));
  if (configured.length === 0) {
    return {
      level: 'warning',
      key: provider.prefix,
      message: 'Integração não configurada; nenhuma conta real será conectada.',
    };
  }
  if (configured.length !== keys.length) {
    return {
      level: 'warning',
      key: provider.prefix,
      message: 'Configuração incompleta; revise as variáveis OAuth no ambiente.',
    };
  }

  try {
    const redirectUrl = new URL(env[provider.redirectKey] as string);
    const localHttpAllowed =
      !production &&
      provider.allowLocalHttp &&
      ['localhost', '127.0.0.1'].includes(redirectUrl.hostname) &&
      redirectUrl.protocol === 'http:';
    const secureHttpsAllowed = redirectUrl.protocol === 'https:';
    if (
      (!localHttpAllowed && !secureHttpsAllowed) ||
      redirectUrl.pathname !== provider.redirectPath ||
      redirectUrl.search ||
      redirectUrl.hash ||
      redirectUrl.username ||
      redirectUrl.password
    ) {
      throw new Error('invalid redirect');
    }
  } catch {
    return {
      level: 'error',
      key: provider.prefix,
      message: 'URI de callback inválida para o ambiente.',
    };
  }

  return {
    level: 'warning',
    key: provider.prefix,
    message: 'Variáveis configuradas, mas OAuth e publicação real ainda não foram testados.',
  };
}

export function checkEnvironmentReadiness(
  env: NodeJS.ProcessEnv,
  production = env.NODE_ENV === 'production',
): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  if (!env.MONGODB_URI?.trim()) {
    checks.push({
      level: 'error',
      key: 'MONGODB_URI',
      message: 'Configure o MongoDB; autenticação, equipes e posts dependem dele.',
    });
  } else if (!isValidMongoUri(env.MONGODB_URI.trim())) {
    checks.push({
      level: 'error',
      key: 'MONGODB_URI',
      message: 'MONGODB_URI precisa usar mongodb:// ou mongodb+srv://.',
    });
  }

  if (!env.PUBLIC_APP_URL?.trim()) {
    checks.push({
      level: 'error',
      key: 'PUBLIC_APP_URL',
      message: 'Configure a origem pública do app para links e mídia.',
    });
  } else if (!isValidApplicationUrl(env.PUBLIC_APP_URL.trim(), production)) {
    checks.push({
      level: 'error',
      key: 'PUBLIC_APP_URL',
      message: production
        ? 'Em produção, PUBLIC_APP_URL precisa ser HTTPS e não pode incluir caminho, credenciais ou query.'
        : 'PUBLIC_APP_URL precisa ser HTTPS ou localhost HTTP e não pode incluir caminho, credenciais ou query.',
    });
  }

  for (const [key, description] of [
    ['MEDIA_URL_SIGNING_KEY', 'chave de assinatura de mídia'],
    ['SOCIAL_TOKEN_ENCRYPTION_KEY', 'chave de criptografia dos tokens sociais'],
  ] as const) {
    const value = env[key]?.trim();
    if (!value) {
      checks.push({
        level: 'error',
        key,
        message: `Configure ${description} com 32 bytes em base64.`,
      });
    } else if (!isValidBase64Key(value)) {
      checks.push({
        level: 'error',
        key,
        message: `${key} precisa decodificar para exatamente 32 bytes.`,
      });
    }
  }

  if (!env.CRON_SECRET || env.CRON_SECRET.length < 32) {
    checks.push({
      level: 'error',
      key: 'CRON_SECRET',
      message: 'Configure um CRON_SECRET com pelo menos 32 caracteres aleatórios.',
    });
  }

  if (!getSmtpConfiguration(env)) {
    checks.push({
      level: 'error',
      key: 'SMTP',
      message:
        'Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD e SMTP_FROM para verificar cadastro e recuperar senha.',
    });
  }

  if (production) {
    if (!env.LEGAL_OPERATOR_NAME?.trim() || !env.SUPPORT_EMAIL?.trim() || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.SUPPORT_EMAIL)) checks.push({level:'warning',key:'PUBLIC_INFORMATION',message:'Preencha LEGAL_OPERATOR_NAME e SUPPORT_EMAIL e revise os textos públicos antes de liberar o produto.'});
    const uploadsDirectory = env.FEEDSYNC_UPLOADS_DIR?.trim();
    if (uploadsDirectory && !path.isAbsolute(uploadsDirectory)) {
      checks.push({
        level: 'error',
        key: 'FEEDSYNC_UPLOADS_DIR',
        message:
          'Em produção, FEEDSYNC_UPLOADS_DIR deve ser um caminho absoluto.',
      });
    }
    checks.push({
      level: 'warning',
      key: 'FEEDSYNC_UPLOADS_DIR',
      message:
        `Mídias usam filesystem local (${uploadsDirectory ? 'caminho configurado' : 'uploads/ padrão'}); confirme que o diretório é um volume persistente.`,
    });
  }

  for (const provider of oauthProviders) {
    const check = validateOAuthProvider(env, provider, production);
    if (check) checks.push(check);
  }

  return checks;
}
