const DAY_MS = 86_400_000;
export const HISTORY_RETENTION_DAYS = 180;
export const BACKUP_RETENTION_DAYS = 30;

export interface RetentionPost {
  status?: string;
  deletedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  history?: { at?: string }[];
  processingRunId?: string;
  publishMayHaveSucceeded?: boolean;
  publishStates?: { state?: string; mayHaveSucceeded?: boolean }[];
}

export function assessPostRetention(post: RetentionPost, now: Date) {
  const keep = (reason: string) => ({ decision: 'preserve' as const, reason, referenceAt: null });
  if (post.publishMayHaveSucceeded || post.publishStates?.some(state => state.mayHaveSucceeded)) return keep('uncertain_result');
  if (post.status === 'processing' || post.processingRunId || post.publishStates?.some(state => ['uploading', 'processing'].includes(state.state ?? ''))) return keep('in_progress');
  if (!post.deletedAt && post.status !== 'published') return keep('active_or_requires_review');
  if (!post.deletedAt && (!post.publishStates?.length || post.publishStates.some(state => state.state !== 'published'))) return keep('inconsistent_publication');
  // No finalization timestamp exists yet. The latest update/history/deletion is
  // a conservative lower bound: it can postpone review, never advance it.
  const dates = [post.updatedAt, ...(post.deletedAt ? [post.deletedAt] : []), ...(post.history ?? []).map(entry => entry.at)];
  const times = dates.map(value => value ? new Date(value).getTime() : NaN);
  if (!times.length || times.some(time => !Number.isFinite(time) || time > now.getTime())) return keep('unreliable_dates');
  const reference = Math.max(...times);
  return {
    decision: now.getTime() - reference >= HISTORY_RETENTION_DAYS * DAY_MS ? 'review_candidate' as const : 'preserve' as const,
    reason: now.getTime() - reference >= HISTORY_RETENTION_DAYS * DAY_MS ? 'proposed_period_reached' : 'within_proposed_period',
    referenceAt: new Date(reference).toISOString(),
  };
}

export function assessBackupRetention(name: string, modifiedAt: Date, now: Date) {
  const match = /^arcsync-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-\d+\.fsbk$/.exec(name);
  if (!match) return { decision: 'preserve', reason: 'unknown_filename' };
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.000Z`;
  const namedAt = new Date(iso);
  if (!Number.isFinite(namedAt.getTime()) || namedAt.toISOString() !== iso || !Number.isFinite(modifiedAt.getTime())) return { decision: 'preserve', reason: 'unreliable_dates' };
  const reference = Math.max(namedAt.getTime(), modifiedAt.getTime());
  if (reference > now.getTime()) return { decision: 'preserve', reason: 'unreliable_dates' };
  return {
    decision: now.getTime() - reference >= BACKUP_RETENTION_DAYS * DAY_MS ? 'review_candidate' : 'preserve',
    reason: now.getTime() - reference >= BACKUP_RETENTION_DAYS * DAY_MS ? 'requires_verified_restore_and_policy_approval' : 'within_proposed_period',
  };
}
