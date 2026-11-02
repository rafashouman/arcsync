import type { PostRecord } from '@/src/types/post';
export function publishingMonitor(posts: PostRecord[], now: number) {
  return posts.flatMap(post => post.platforms.flatMap(platform => {
    const state = post.platformStatuses?.find(s => s.platform === platform);
    if (state?.state === 'published') return [];
    const due = Date.parse(post.destinations?.find(d => d.platform === platform)?.scheduledFor || post.scheduledFor || '');
    const issue = state?.mayHaveSucceeded || post.publishMayHaveSucceeded ? 'Resultado incerto' : state?.state === 'failed' || post.status === 'failed' ? 'Falha' : post.status !== 'draft' && due < now - 120000 && !['pending','rejected'].includes(post.approvalStatus ?? '') ? 'Atrasado' : null;
    return issue ? [{postId:post._id,platform,issue,scheduledFor:Number.isFinite(due) ? new Date(due).toISOString() : 'Sem horário'}] : [];
  }));
}
