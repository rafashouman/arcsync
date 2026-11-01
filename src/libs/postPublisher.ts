import 'server-only';

import {
  finalizeClaimedPost,
  type ClaimedPost,
} from '@/src/data/posts';
import { getNextPublishPlatform } from '@/src/libs/publishPlanning';
import { publishClaimedInstagramPost } from '@/src/libs/instagramPublisher';
import { publishClaimedTikTokPost } from '@/src/libs/tiktokPublisher';
import { publishClaimedYouTubePost } from '@/src/libs/youtubePublisher';

export async function publishClaimedPost(post: ClaimedPost) {
  const platform = getNextPublishPlatform(post.platforms, post.publishStates);
  if (!platform) {
    const finalized = await finalizeClaimedPost(post);
    return finalized
      ? post.publishStates.some((record) => record.state === 'failed')
        ? 'failed' as const
        : 'published' as const
      : 'lost-claim' as const;
  }

  switch (platform) {
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
