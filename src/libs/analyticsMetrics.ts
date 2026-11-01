export interface YouTubeVideoStatistics {
  videoId: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseCount(value: unknown) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) ? count : null;
}

export function parseYouTubeStatistics(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('A resposta de métricas do YouTube é inválida.');
  }

  return value.items.flatMap((item): YouTubeVideoStatistics[] => {
    if (!isRecord(item) || typeof item.id !== 'string' || !isRecord(item.statistics)) {
      return [];
    }
    return [{
      videoId: item.id,
      views: parseCount(item.statistics.viewCount),
      likes: parseCount(item.statistics.likeCount),
      comments: parseCount(item.statistics.commentCount),
    }];
  });
}

export function summarizeYouTubeStatistics(videos: YouTubeVideoStatistics[]) {
  const sumAvailable = (key: 'views' | 'likes' | 'comments') => {
    const values = videos
      .map((video) => video[key])
      .filter((count): count is number => count !== null);
    if (values.length === 0) return null;
    const total = values.reduce((sum, count) => sum + count, 0);
    return Number.isSafeInteger(total) ? total : null;
  };

  return {
    videoCount: videos.length,
    views: sumAvailable('views'),
    likes: sumAvailable('likes'),
    comments: sumAvailable('comments'),
  };
}
