import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatZonedDate,
  formatZonedTime,
  getDateTimeInputValues,
  getZonedDateTimeParts,
  isValidTimeZone,
  rescheduleIsoToCalendarDay,
  zonedDateTimeToIso,
} from '../src/libs/timeZones.ts';
import {
  canRetryPost,
  getInstagramPublishingIssue,
  getTikTokPublishingIssue,
  validatePostInput,
} from '../src/libs/postValidation.ts';
import {
  getNextPublishPlatform,
  getPostPublishOutcome,
  getYouTubeMetadata,
  planTikTokChunks,
  planYouTubeChunks,
} from '../src/libs/publishPlanning.ts';
import {
  canCreateWorkspacePosts,
  canInviteWorkspaceRole,
  canManageWorkspace,
  canReviewWorkspacePosts,
  requiresPostApproval,
} from '../src/libs/workspacePermissions.ts';

test('enforces the MVP workspace role permissions', () => {
  assert.equal(canManageWorkspace('owner'), true);
  assert.equal(canManageWorkspace('admin'), true);
  assert.equal(canManageWorkspace('editor'), false);
  assert.equal(canCreateWorkspacePosts('editor'), true);
  assert.equal(canCreateWorkspacePosts('approver'), false);
  assert.equal(requiresPostApproval('editor'), true);
  assert.equal(requiresPostApproval('admin'), false);
  assert.equal(canReviewWorkspacePosts('approver'), true);
  assert.equal(canReviewWorkspacePosts('editor'), false);
  assert.equal(canInviteWorkspaceRole('owner', 'admin'), true);
  assert.equal(canInviteWorkspaceRole('admin', 'admin'), false);
  assert.equal(canInviteWorkspaceRole('admin', 'editor'), true);
});

test('publishes the next unfinished network without retrying completed or failed ones', () => {
  const platforms = ['instagram', 'tiktok', 'youtube'];
  const states = [
    { platform: 'instagram', state: 'published' },
    { platform: 'tiktok', state: 'failed' },
  ];

  assert.equal(getNextPublishPlatform(platforms, states), 'youtube');
  assert.equal(
    getNextPublishPlatform(platforms, [
      ...states,
      { platform: 'youtube', state: 'uploading' },
    ]),
    'youtube',
  );
  assert.equal(
    getNextPublishPlatform(platforms, [
      ...states,
      { platform: 'youtube', state: 'published' },
    ]),
    undefined,
  );
});

test('aggregates multi-network results only after every selected network finishes', () => {
  const platforms = ['instagram', 'youtube'];
  assert.equal(
    getPostPublishOutcome(platforms, [
      { platform: 'instagram', state: 'published' },
    ]),
    'pending',
  );
  assert.equal(
    getPostPublishOutcome(platforms, [
      { platform: 'instagram', state: 'published' },
      { platform: 'youtube', state: 'published' },
    ]),
    'published',
  );
  assert.equal(
    getPostPublishOutcome(platforms, [
      { platform: 'instagram', state: 'published' },
      { platform: 'youtube', state: 'failed' },
    ]),
    'failed',
  );
});

test('validates IANA time zones', () => {
  assert.equal(isValidTimeZone('America/Sao_Paulo'), true);
  assert.equal(isValidTimeZone('UTC'), true);
  assert.equal(isValidTimeZone('Mars/Olympus_Mons'), false);
  assert.equal(isValidTimeZone(''), false);
  assert.equal(isValidTimeZone(null), false);
});

test('converts wall time to UTC while respecting the selected zone', () => {
  assert.equal(
    zonedDateTimeToIso('2026-10-31', '12:00', 'America/Sao_Paulo'),
    '2026-10-31T15:00:00.000Z',
  );
  assert.equal(
    zonedDateTimeToIso('2026-10-31', '12:00', 'Asia/Tokyo'),
    '2026-10-31T03:00:00.000Z',
  );
});

test('rejects invalid calendar values and local times skipped by DST', () => {
  assert.equal(
    zonedDateTimeToIso('2026-02-30', '12:00', 'UTC'),
    null,
  );
  assert.equal(
    zonedDateTimeToIso('2026-03-08', '02:30', 'America/New_York'),
    null,
  );
  assert.equal(
    zonedDateTimeToIso('2026-10-31', '25:00', 'UTC'),
    null,
  );
});

test('chooses the first occurrence of an ambiguous local time', () => {
  assert.equal(
    zonedDateTimeToIso('2026-11-01', '01:30', 'America/New_York'),
    '2026-11-01T05:30:00.000Z',
  );
});

test('rescheduling preserves local time and resolves target-day DST changes', () => {
  assert.equal(
    rescheduleIsoToCalendarDay(
      '2026-10-31T13:15:00.000Z',
      '2026-11-02',
      'America/New_York',
    ),
    '2026-11-02T14:15:00.000Z',
  );
  assert.equal(
    rescheduleIsoToCalendarDay(
      '2026-03-07T07:30:00.000Z',
      '2026-03-08',
      'America/New_York',
    ),
    null,
  );
  assert.equal(
    rescheduleIsoToCalendarDay(
      '2026-10-31T05:30:00.000Z',
      '2026-11-01',
      'America/New_York',
    ),
    '2026-11-01T05:30:00.000Z',
  );
});

test('formats and restores local date/time values in the selected zone', () => {
  const iso = '2026-10-31T15:00:00.000Z';
  assert.deepEqual(getDateTimeInputValues(iso, 'America/Sao_Paulo'), {
    date: '2026-10-31',
    time: '12:00',
  });
  assert.deepEqual(getZonedDateTimeParts(iso, 'America/Sao_Paulo'), {
    year: 2026,
    month: 10,
    day: 31,
    hour: 12,
    minute: 0,
    second: 0,
  });
  assert.equal(formatZonedTime(iso, 'America/Sao_Paulo'), '12:00');
  assert.match(formatZonedDate(iso, 'America/Sao_Paulo'), /31 de out\./);
});

test('accepts a content draft without a platform or scheduled time', () => {
  const result = validatePostInput(
    {
      caption: '  Ideia para depois  ',
      platforms: [],
      scheduledFor: null,
      timeZone: 'America/Sao_Paulo',
      mediaUrls: [],
    },
    'a'.repeat(64),
    true,
    Date.UTC(2026, 0, 1),
  );

  assert.deepEqual(result, {
    caption: 'Ideia para depois',
    platforms: [],
    scheduledFor: null,
    timeZone: 'America/Sao_Paulo',
    mediaUrls: [],
    tiktokTitle: null,
    tiktokPrivacyLevel: null,
    tiktokAllowComments: false,
    tiktokAllowDuet: false,
    tiktokAllowStitch: false,
    tiktokCommercialContent: false,
    tiktokBrandOrganic: false,
    tiktokBrandContent: false,
    tiktokConsentAt: null,
  });
});

test('rejects empty drafts and posts missing required scheduling data', () => {
  const ownerKey = 'a'.repeat(64);
  const emptyDraft = validatePostInput(
    {
      caption: ' ',
      platforms: [],
      scheduledFor: null,
      timeZone: 'UTC',
      mediaUrls: [],
    },
    ownerKey,
    true,
  );
  const incompleteScheduledPost = validatePostInput(
    {
      caption: '',
      platforms: ['instagram'],
      scheduledFor: null,
      timeZone: 'UTC',
      mediaUrls: [],
    },
    ownerKey,
    false,
  );

  assert.equal(typeof emptyDraft, 'string');
  assert.match(emptyDraft, /Adicione uma legenda/);
  assert.equal(typeof incompleteScheduledPost, 'string');
  assert.match(incompleteScheduledPost, /Data e hora/);
});

test('requires a future time, valid platform, and media owned by this user', () => {
  const ownerKey = 'a'.repeat(64);
  const now = Date.UTC(2026, 0, 1);
  const validPost = {
    caption: '',
    platforms: ['instagram'],
    scheduledFor: '2026-01-01T00:01:00.000Z',
    timeZone: 'UTC',
    mediaUrls: [
      `/api/media/${ownerKey}/123e4567-e89b-12d3-a456-426614174000.jpg`,
    ],
  };

  assert.notEqual(
    typeof validatePostInput(validPost, ownerKey, false, now),
    'string',
  );
  assert.match(
    validatePostInput(
      { ...validPost, scheduledFor: '2026-01-01T00:00:00.000Z' },
      ownerKey,
      false,
      now,
    ),
    /futuro/,
  );
  assert.match(
    validatePostInput(
      { ...validPost, platforms: ['unsupported'] },
      ownerKey,
      false,
      now,
    ),
    /plataforma válida/,
  );
  assert.match(
    validatePostInput(
      {
        ...validPost,
        mediaUrls: [
          `/api/media/${'b'.repeat(64)}/123e4567-e89b-12d3-a456-426614174000.jpg`,
        ],
      },
      ownerKey,
      false,
      now,
    ),
    /mídia enviados são inválidos/,
  );
});

test('validates Instagram caption and media requirements before scheduling', () => {
  const jpg = '/api/media/owner/123e4567-e89b-12d3-a456-426614174000.jpg';
  const png = '/api/media/owner/123e4567-e89b-12d3-a456-426614174000.png';
  const mp4 = '/api/media/owner/123e4567-e89b-12d3-a456-426614174000.mp4';

  assert.equal(getInstagramPublishingIssue('Legenda válida', [jpg]), null);
  assert.equal(getInstagramPublishingIssue('Legenda válida', [mp4]), null);
  assert.match(
    getInstagramPublishingIssue('x'.repeat(2201), [jpg]),
    /2.200 caracteres/,
  );
  assert.match(
    getInstagramPublishingIssue('Legenda válida', []),
    /anexe de 1 a 10 mídias/,
  );
  assert.match(
    getInstagramPublishingIssue('Legenda válida', [png]),
    /JPG.*MP4 ou MOV/,
  );
});

test('requires TikTok privacy and explicit consent before scheduling', () => {
  const ownerKey = 'a'.repeat(64);
  const video =
    `/api/media/${ownerKey}/123e4567-e89b-12d3-a456-426614174000.mp4`;
  const validPost = {
    caption: 'Vídeo de teste',
    platforms: ['tiktok'],
    scheduledFor: '2026-01-01T00:01:00.000Z',
    timeZone: 'UTC',
    mediaUrls: [video],
    tiktokPrivacyLevel: 'SELF_ONLY',
    tiktokConsent: true,
  };
  const now = Date.UTC(2026, 0, 1);
  const accepted = validatePostInput(validPost, ownerKey, false, now);

  assert.notEqual(typeof accepted, 'string');
  assert.equal(accepted.tiktokPrivacyLevel, 'SELF_ONLY');
  assert.equal(accepted.tiktokConsentAt, new Date(now).toISOString());
  assert.match(
    validatePostInput(
      { ...validPost, tiktokPrivacyLevel: null },
      ownerKey,
      false,
      now,
    ),
    /Escolha manualmente a privacidade/,
  );
  assert.match(
    validatePostInput(
      { ...validPost, tiktokConsent: false },
      ownerKey,
      false,
      now,
    ),
    /Confirme o envio/,
  );
});

test('validates TikTok commercial disclosure and chunk boundaries', () => {
  const ownerKey = 'a'.repeat(64);
  const validPost = {
    caption: 'Vídeo',
    platforms: ['tiktok'],
    scheduledFor: '2026-01-01T00:01:00.000Z',
    timeZone: 'UTC',
    mediaUrls: [
      `/api/media/${ownerKey}/123e4567-e89b-12d3-a456-426614174000.mp4`,
    ],
    tiktokPrivacyLevel: 'SELF_ONLY',
    tiktokConsent: true,
    tiktokCommercialContent: true,
  };
  const now = Date.UTC(2026, 0, 1);

  assert.match(
    validatePostInput(validPost, ownerKey, false, now),
    /Indique se o conteúdo promove/,
  );
  assert.match(
    validatePostInput(
      { ...validPost, tiktokBrandContent: true },
      ownerKey,
      false,
      now,
    ),
    /terceiros não pode ter privacidade/,
  );

  const videoSize = 64 * 1024 * 1024 + 1;
  const plan = planTikTokChunks(videoSize);
  assert.equal(plan.ranges[0].start, 0);
  assert.equal(plan.ranges.at(-1).end, videoSize - 1);
  assert.equal(
    plan.ranges.reduce((total, range) => total + range.end - range.start + 1, 0),
    videoSize,
  );
});

test('validates TikTok title length against its UTF-16 limit', () => {
  const video = '/api/media/owner/123e4567-e89b-12d3-a456-426614174000.mp4';
  assert.equal(getTikTokPublishingIssue('x'.repeat(2200), [video]), null);
  assert.match(
    getTikTokPublishingIssue('x'.repeat(2201), [video]),
    /2.200 caracteres/,
  );
});

test('allows retry for confirmed failures without retrying uncertain results', () => {
  assert.equal(
    canRetryPost({
      status: 'failed',
      platforms: ['instagram'],
      publishMayHaveSucceeded: false,
    }),
    true,
  );
  assert.equal(
    canRetryPost({
      status: 'failed',
      platforms: ['instagram'],
      publishMayHaveSucceeded: true,
    }),
    false,
  );
  assert.equal(
    canRetryPost({
      status: 'failed',
      platforms: ['instagram', 'youtube'],
      platformStatuses: [{ platform: 'instagram', state: 'failed' }],
    }),
    true,
  );
  assert.equal(
    canRetryPost({
      status: 'published',
      platforms: ['instagram'],
    }),
    false,
  );
  assert.equal(
    canRetryPost({
      status: 'failed',
      platforms: ['instagram', 'youtube'],
      platformStatuses: [
        { platform: 'instagram', state: 'failed', mayHaveSucceeded: true },
      ],
    }),
    false,
  );
});

test('plans valid resumable YouTube upload chunks', () => {
  assert.deepEqual(planYouTubeChunks(1), {
    chunkSize: 8 * 1024 * 1024,
    totalChunkCount: 1,
    ranges: [{ start: 0, end: 0 }],
  });
  assert.deepEqual(planYouTubeChunks(8 * 1024 * 1024 + 1), {
    chunkSize: 8 * 1024 * 1024,
    totalChunkCount: 2,
    ranges: [
      { start: 0, end: 8 * 1024 * 1024 - 1 },
      { start: 8 * 1024 * 1024, end: 8 * 1024 * 1024 },
    ],
  });
  assert.throws(() => planYouTubeChunks(0), /tamanho do vídeo é inválido/);
  assert.deepEqual(getYouTubeMetadata('  Título  \nDescrição <teste>  '), {
    title: 'Título',
    description: 'Título  \nDescrição teste',
  });
});
