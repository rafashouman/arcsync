import 'server-only';
import { recordPublicationEvent } from '@/src/data/monitorLogs';
import { publishClaimedFacebookPost } from '@/src/libs/facebookPublisher';

import {
  finalizeClaimedPost,
  releaseClaimedPost,
  failClaimedPost,
  type ClaimedPost,
} from '@/src/data/posts';
import { planDestinations } from '@/src/libs/destinationPlanning';
import { publishClaimedInstagramPost } from '@/src/libs/instagramPublisher';
import { publishClaimedTikTokPost } from '@/src/libs/tiktokPublisher';
import { publishClaimedYouTubePost } from '@/src/libs/youtubePublisher';

export async function publishClaimedPost(post: ClaimedPost) {
  const plan = planDestinations(post, post.publishStates, Date.now());
  let outcome: Awaited<ReturnType<typeof executeStep>>;
  try {
    outcome = await executeStep(post, plan);
  } catch (error) {
    await recordPublicationEvent(post.workspaceId, post._id, 'worker-error', plan.platform, post.processingRunId);
    throw error;
  }
  if (outcome !== 'waiting') {
    await recordPublicationEvent(post.workspaceId, post._id, outcome === 'retrying' ? 'retry' : outcome, plan.platform, post.processingRunId);
  }
  return outcome;
}

async function executeStep(post: ClaimedPost, plan: ReturnType<typeof planDestinations>) {
  const platform = plan.platform;
  if (!platform && !plan.complete) {
    if (!Number.isFinite(plan.nextAt)) { await failClaimedPost(post._id, post.processingRunId, 'Horário de destino inválido.'); return 'failed' as const; }
    await releaseClaimedPost(post._id, post.processingRunId, new Date(plan.nextAt!));
    return 'waiting' as const;
  }
  if (!platform) {
    const finalized = await finalizeClaimedPost(post);
    return finalized
      ? post.publishStates.some((record) => record.state === 'failed')
        ? 'failed' as const
        : 'published' as const
      : 'lost-claim' as const;
  }

  const destination = post.destinations?.find(d => d.platform === platform);
  if (!destination?.accountId) {
    await failClaimedPost(post._id, post.processingRunId, 'Selecione explicitamente as contas de destino antes de publicar este agendamento legado.');
    return 'failed' as const;
  }
  post = { ...post, caption: destination.caption || post.caption, mediaUrls: destination.mediaUrls ?? post.mediaUrls };
  switch (platform) {
    case 'facebook':
      return publishClaimedFacebookPost(post);
    case 'instagram':
      return publishClaimedInstagramPost(post);
    case 'youtube':
      return publishClaimedYouTubePost(post);
    case 'tiktok':
      return publishClaimedTikTokPost(post);
    default:
      throw new Error('O post contém uma plataforma social não suportada.');
  }
}
