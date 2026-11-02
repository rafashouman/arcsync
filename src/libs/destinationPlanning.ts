import type { PostRecord, SocialPlatform } from '@/src/types/post';
export function planDestinations(post: Pick<PostRecord, 'platforms' | 'destinations' | 'scheduledFor'>, states: {platform: SocialPlatform; state: string}[], now: number) {
  const remaining = post.platforms.filter(platform => !states.some(s => s.platform === platform && (s.state === 'published' || s.state === 'failed')));
  const ordered = remaining.map(platform => ({platform, time: Date.parse(post.destinations?.find(d => d.platform === platform)?.scheduledFor || post.scheduledFor || '')})).sort((a,b) => a.time-b.time);
  return {platform: ordered.find(d => d.time <= now)?.platform, nextAt: ordered[0]?.time, complete: remaining.length === 0};
}
