import { randomUUID, timingSafeEqual } from 'crypto';
import { claimDuePost } from '@/src/data/posts';
import { publishClaimedPost } from '@/src/libs/postPublisher';
import { getInstagramOAuthConfig } from '@/src/libs/instagramOAuth';
import { getTikTokOAuthConfig } from '@/src/libs/tiktokOAuth';
import { getYouTubeOAuthConfig } from '@/src/libs/youtubeOAuth';
import { hasSocialTokenEncryptionKey } from '@/src/libs/socialTokenCrypto';
import { SocialOAuthConfigurationError } from '@/src/libs/socialOAuth';

export const maxDuration = 60;

const LEASE_MS = 10 * 60 * 1000;

function hasOAuthConfig(getConfig: () => unknown) {
  try {
    getConfig();
    return true;
  } catch (error) {
    if (error instanceof SocialOAuthConfigurationError) return false;
    throw error;
  }
}

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get('authorization') ?? '';
  const supplied = Buffer.from(authorization.replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(secret);
  return (
    /^Bearer\s+/i.test(authorization) &&
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected)
  );
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    return Response.json(
      { error: 'CRON_SECRET deve ter pelo menos 32 caracteres.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request, secret)) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  if (
    !process.env.MONGODB_URI ||
    !hasSocialTokenEncryptionKey()
  ) {
    return Response.json(
      {
        error: 'Configure MongoDB e SOCIAL_TOKEN_ENCRYPTION_KEY.',
      },
      { status: 503 },
    );
  }
  const hasInstagramConfig = hasOAuthConfig(getInstagramOAuthConfig);
  const hasTikTokConfig = hasOAuthConfig(getTikTokOAuthConfig);
  const hasYouTubeConfig = hasOAuthConfig(getYouTubeOAuthConfig);
  if (!hasInstagramConfig && !hasTikTokConfig && !hasYouTubeConfig) {
    return Response.json(
      {
        error:
          'Configure as credenciais do Instagram, TikTok ou YouTube no servidor.',
      },
      { status: 503 },
    );
  }

  try {
    const post = await claimDuePost(new Date(), randomUUID(), LEASE_MS);
    if (!post) return Response.json({ status: 'idle' });

    const result = await publishClaimedPost(post);
    return Response.json({ status: result });
  } catch (error) {
    console.error('Falha ao executar a fila de publicação:', error);
    return Response.json(
      { error: 'Não foi possível executar a fila de publicação.' },
      { status: 500 },
    );
  }
}
