import type {
  PlatformPublishState,
  PlatformStatus,
  SocialPlatform,
  TikTokPrivacyLevel,
} from '@/src/types/post';

export interface PlatformPublishRecord {
  platform: SocialPlatform;
  state: PlatformPublishState;
  externalId?: string;
  uploadUrl?: string;
  uploadedBytes?: number;
  startedAt?: string;
  error?: string;
  mayHaveSucceeded?: boolean;
}

export const PUBLISH_PLATFORM_ORDER: readonly SocialPlatform[] = [
  'instagram',
  'tiktok',
  'youtube',
];

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

const TIKTOK_SINGLE_CHUNK_LIMIT = 64 * 1024 * 1024;
const TIKTOK_CHUNK_SIZE = 10 * 1024 * 1024;

export const YOUTUBE_CHUNK_SIZE = 8 * 1024 * 1024;
export const YOUTUBE_MINIMUM_CHUNK_SIZE = 256 * 1024;
export const YOUTUBE_TITLE_MAX_LENGTH = 100;
export const YOUTUBE_DESCRIPTION_MAX_BYTES = 5000;
export const TIKTOK_CAPTION_MAX_LENGTH = 2200;
export const TIKTOK_PRIVACY_LEVELS: readonly TikTokPrivacyLevel[] = [
  'PUBLIC_TO_EVERYONE',
  'FOLLOWER_OF_CREATOR',
  'MUTUAL_FOLLOW_FRIENDS',
  'SELF_ONLY',
];

export function orderedPlatforms(platforms: readonly SocialPlatform[]) {
  return PUBLISH_PLATFORM_ORDER.filter((platform) =>
    platforms.includes(platform),
  );
}

export function findPublishRecord(
  records: readonly PlatformPublishRecord[],
  platform: SocialPlatform,
) {
  return records.find((record) => record.platform === platform);
}

export function upsertPublishRecord(
  records: readonly PlatformPublishRecord[],
  next: PlatformPublishRecord,
) {
  return [
    ...records.filter((record) => record.platform !== next.platform),
    next,
  ];
}

export function hasPublishedPlatform(
  records: readonly { state: PlatformPublishState }[],
) {
  return records.some((record) => record.state === 'published');
}

export function getNextPublishPlatform(
  platforms: readonly SocialPlatform[],
  records: readonly PlatformPublishRecord[],
) {
  return orderedPlatforms(platforms).find((platform) => {
    const record = findPublishRecord(records, platform);
    return !record || (record.state !== 'published' && record.state !== 'failed');
  });
}

export function getPostPublishOutcome(
  platforms: readonly SocialPlatform[],
  records: readonly PlatformPublishRecord[],
) {
  const allFinished = platforms.every((platform) => {
    const record = findPublishRecord(records, platform);
    return record?.state === 'published' || record?.state === 'failed';
  });
  if (!allFinished) return 'pending' as const;
  return platforms.every(
    (platform) => findPublishRecord(records, platform)?.state === 'published',
  )
    ? 'published' as const
    : 'failed' as const;
}

export function toPlatformStatuses(
  records: readonly PlatformPublishRecord[],
): PlatformStatus[] {
  return records.map((record) => ({
    platform: record.platform,
    state: record.state,
    ...(record.error ? { error: record.error } : {}),
    ...(record.mayHaveSucceeded ? { mayHaveSucceeded: true } : {}),
  }));
}

export function resetFailedPublishRecords(
  records: readonly PlatformPublishRecord[],
) {
  return records.filter((record) => record.state !== 'failed');
}

export function describePublishFailures(
  records: readonly PlatformPublishRecord[],
) {
  const failures = records
    .filter((record) => record.state === 'failed')
    .map(
      (record) =>
        `${PLATFORM_LABELS[record.platform]}: ${record.error ?? 'falha na publicação.'}`,
    );
  const published = records
    .filter((record) => record.state === 'published')
    .map((record) => PLATFORM_LABELS[record.platform]);
  if (failures.length === 0) return '';
  return published.length > 0
    ? `${failures.join(' ')} Já publicado em: ${published.join(', ')}.`
    : failures.join(' ');
}

export function planTikTokChunks(videoSize: number) {
  if (!Number.isSafeInteger(videoSize) || videoSize <= 0) {
    throw new Error('O tamanho do vídeo é inválido.');
  }

  const chunkSize =
    videoSize <= TIKTOK_SINGLE_CHUNK_LIMIT ? videoSize : TIKTOK_CHUNK_SIZE;
  const totalChunkCount = Math.floor(videoSize / chunkSize);
  const ranges = Array.from({ length: totalChunkCount }, (_, index) => {
    const start = index * chunkSize;
    const end =
      index === totalChunkCount - 1 ? videoSize - 1 : start + chunkSize - 1;
    return { start, end };
  });
  return { chunkSize, totalChunkCount, ranges };
}

export function planYouTubeChunks(videoSize: number) {
  if (!Number.isSafeInteger(videoSize) || videoSize <= 0) {
    throw new Error('O tamanho do vídeo é inválido.');
  }

  const totalChunkCount = Math.ceil(videoSize / YOUTUBE_CHUNK_SIZE);
  const ranges = Array.from({ length: totalChunkCount }, (_, index) => {
    const start = index * YOUTUBE_CHUNK_SIZE;
    const end = Math.min(start + YOUTUBE_CHUNK_SIZE, videoSize) - 1;
    return { start, end };
  });
  return { chunkSize: YOUTUBE_CHUNK_SIZE, totalChunkCount, ranges };
}

export function getYouTubeMetadata(caption: string) {
  const cleaned = caption.replace(/[<>]/g, '');
  const firstLine =
    cleaned
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? '';
  return {
    title: [...firstLine].slice(0, YOUTUBE_TITLE_MAX_LENGTH).join(''),
    description: cleaned.trim(),
  };
}
