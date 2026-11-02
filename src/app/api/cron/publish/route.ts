import { randomUUID } from 'crypto';
import { beginQueueRun, finishQueueRun } from '@/src/data/operations';
import { isOperationsAuthorized } from '@/src/libs/operationsAuth';
import { claimDuePost } from '@/src/data/posts';
import { publishClaimedPost } from '@/src/libs/postPublisher';
import { getInstagramOAuthConfig, InstagramOAuthConfigurationError } from '@/src/libs/instagramOAuth';
import { getTikTokOAuthConfig } from '@/src/libs/tiktokOAuth';
import { getYouTubeOAuthConfig } from '@/src/libs/youtubeOAuth';
import { getFacebookOAuthConfig } from '@/src/libs/facebookOAuth';
import { hasSocialTokenEncryptionKey } from '@/src/libs/socialTokenCrypto';
import { SocialOAuthConfigurationError } from '@/src/libs/socialOAuth';

export const maxDuration = 60;

const LEASE_MS = 10 * 60 * 1000;

function hasOAuthConfig(getConfig: () => unknown) {
  try {
    getConfig();
    return true;
  } catch (error) {
    if (error instanceof SocialOAuthConfigurationError || error instanceof InstagramOAuthConfigurationError) return false;
    throw error;
  }
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    return Response.json(
      { error: 'CRON_SECRET deve ter pelo menos 32 caracteres.' },
      { status: 503 },
    );
  }
  if (!isOperationsAuthorized(request, secret)) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let runId: string;
  try { runId = await beginQueueRun(); }
  catch { return Response.json({error:'Não foi possível registrar a execução no banco.'},{status:503}); }
  async function blocked(error:string) {
    await finishQueueRun(runId,'blocked');
    return Response.json({error},{status:503});
  }

  try {
  if (process.env.PUBLISHING_ENABLED !== 'true') return await blocked('Publicação automática desativada.');

  if (
    !process.env.MONGODB_URI ||
    !hasSocialTokenEncryptionKey()
  ) {
    return await blocked('Configure MongoDB e SOCIAL_TOKEN_ENCRYPTION_KEY.');
  }
  const hasInstagramConfig = hasOAuthConfig(getInstagramOAuthConfig);
  const hasTikTokConfig = hasOAuthConfig(getTikTokOAuthConfig);
  const hasYouTubeConfig = hasOAuthConfig(getYouTubeOAuthConfig);
  const hasFacebookConfig = hasOAuthConfig(getFacebookOAuthConfig);
  if (!hasInstagramConfig && !hasTikTokConfig && !hasYouTubeConfig && !hasFacebookConfig) {
    return await blocked('Configure as credenciais de ao menos uma rede no servidor.');
  }

    const results: string[] = [];
    const startedAt = Date.now();
    // Three independent reservations at a time, at most twelve steps per call.
    for (let batch = 0; batch < 4 && Date.now() - startedAt < 35_000; batch++) {
      const posts = [];
      for (let slot = 0; slot < 3; slot++) {
        const post = await claimDuePost(new Date(), randomUUID(), LEASE_MS);
        if (post) posts.push(post);
      }
      if (!posts.length) break;
      const outcomes = await Promise.allSettled(posts.map(post => publishClaimedPost(post)));
      for (const outcome of outcomes) {
        results.push(outcome.status === 'fulfilled' ? outcome.value : 'worker-error');
        if (outcome.status === 'rejected') console.error('Falha em uma etapa da fila:', outcome.reason);
      }
    }
    const degraded = results.some(result => ['worker-error','failed','uncertain','lost-claim'].includes(result));
    await finishQueueRun(runId,degraded ? 'degraded' : 'healthy',results.length);
    return Response.json({ status: results.length ? 'processed' : 'idle', processed: results.length, results },{status:degraded ? 207 : 200});
  } catch (error) {
    console.error('Falha ao executar a fila de publicação:', error);
    await finishQueueRun(runId,'failed').catch(() => {});
    return Response.json(
      { error: 'Não foi possível executar a fila de publicação.' },
      { status: 500 },
    );
  }
}
