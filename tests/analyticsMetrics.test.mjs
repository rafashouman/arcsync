import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseYouTubeStatistics,
  summarizeYouTubeStatistics,
} from '../src/libs/analyticsMetrics.ts';

test('parses YouTube statistics and sums only available metrics', () => {
  const videos = parseYouTubeStatistics({
    items: [
      {
        id: 'abcdefghijk',
        statistics: {
          viewCount: '1200',
          likeCount: '80',
          commentCount: '12',
        },
      },
      {
        id: 'lmnopqrstuv',
        statistics: { viewCount: '300', commentCount: '3' },
      },
    ],
  });

  assert.deepEqual(videos, [
    {
      videoId: 'abcdefghijk',
      views: 1200,
      likes: 80,
      comments: 12,
    },
    {
      videoId: 'lmnopqrstuv',
      views: 300,
      likes: null,
      comments: 3,
    },
  ]);
  assert.deepEqual(summarizeYouTubeStatistics(videos), {
    videoCount: 2,
    views: 1500,
    likes: 80,
    comments: 15,
  });
});

test('rejects malformed YouTube responses and ignores unsafe counts', () => {
  assert.throws(() => parseYouTubeStatistics({ items: null }));
  const videos = parseYouTubeStatistics({
    items: [
      {
        id: 'abcdefghijk',
        statistics: {
          viewCount: '9007199254740992',
          likeCount: '-1',
          commentCount: 1,
        },
      },
      { id: 'missing-stats' },
    ],
  });
  assert.deepEqual(videos, [
    {
      videoId: 'abcdefghijk',
      views: null,
      likes: null,
      comments: null,
    },
  ]);
  assert.deepEqual(summarizeYouTubeStatistics(videos), {
    videoCount: 1,
    views: null,
    likes: null,
    comments: null,
  });
});
