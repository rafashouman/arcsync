import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarDays, postsOnDay } from '../src/libs/calendarSummary.ts';

test('seven-day summary crosses month and year boundaries using calendar dates', () => {
  const days = calendarDays(new Date(2027, 0, 1), 3, 3);
  assert.equal(days.length, 7);
  assert.deepEqual(days.map(day => [day.getFullYear(), day.getMonth() + 1, day.getDate()]), [[2026,12,29],[2026,12,30],[2026,12,31],[2027,1,1],[2027,1,2],[2027,1,3],[2027,1,4]]);
});
test('summary respects publication timezone, excludes drafts, sorts without mutating', () => {
  const posts = [
    { _id: 'later', status: 'pending', scheduledFor: '2026-11-08T02:00:00Z', timeZone: 'America/Sao_Paulo' },
    { _id: 'earlier', status: 'published', scheduledFor: '2026-11-07T15:00:00Z', timeZone: 'America/Sao_Paulo' },
    { _id: 'draft', status: 'draft', scheduledFor: '2026-11-07T15:00:00Z', timeZone: 'America/Sao_Paulo' },
    { _id: 'next-day', status: 'pending', scheduledFor: '2026-11-08T02:00:00Z', timeZone: 'UTC' },
    { _id: 'unscheduled', status: 'pending', scheduledFor: null, timeZone: null },
  ];
  assert.deepEqual(postsOnDay(posts, new Date(2026, 10, 7)).map(post => post._id), ['earlier', 'later']);
  assert.equal(posts[0]._id, 'later');
});
test('invalid legacy timezone uses the supplied viewing timezone', () => {
  const posts = [{ _id: 'legacy', status: 'failed', scheduledFor: '2026-11-08T02:00:00Z', timeZone: 'invalid' }];
  assert.equal(postsOnDay(posts, new Date(2026, 10, 7), 'America/Sao_Paulo').length, 1);
  assert.equal(postsOnDay(posts, new Date(2026, 10, 8), 'UTC').length, 1);
});
