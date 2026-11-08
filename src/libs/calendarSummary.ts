import { getZonedDateTimeParts, isValidTimeZone } from './timeZones';
import type { PostRecord } from '@/src/types/post';

export function postsOnDay(posts: PostRecord[], day: Date, fallbackTimeZone = 'America/Sao_Paulo') {
  return posts.filter(post => {
    if (!post.scheduledFor || post.status === 'draft') return false;
    const parts = getZonedDateTimeParts(post.scheduledFor, isValidTimeZone(post.timeZone) ? post.timeZone : fallbackTimeZone);
    return parts.year === day.getFullYear() && parts.month === day.getMonth() + 1 && parts.day === day.getDate();
  }).sort((a, b) => Date.parse(a.scheduledFor!) - Date.parse(b.scheduledFor!));
}
export function calendarDays(anchor: Date, before: number, after: number) {
  return Array.from({ length: before + after + 1 }, (_, index) => new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + index - before));
}
