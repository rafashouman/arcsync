import 'server-only';

import { readFile } from 'fs/promises';
import { createSignedMediaUrl } from '@/src/libs/mediaStorage';
import {
  completeClaimedPlatform,
  failClaimedPlatform,
  releaseClaimedPost,
  updateClaimedPost,
  type ClaimedPost,
} from '@/src/data/posts';
import { reserveTikTokPostingUser } from '@/src/data/tiktokPostingQuota';
import { getDefaultSocialAccountForWorkspace } from '@/src/data/socialAccounts';
import { getOwnedLocalVideo, readFileRange } from '@/src/libs/ownedMedia';
import {
  getTikTokPublishingIssue,
} from '@/src/libs/postValidation';
import {
  planTikTokChunks,
  upsertPublishRecord,
  type PlatformPublishRecord,
} from '@/src/libs/publishPlanning';
import { getValidSocialAccessToken } from '@/src/libs/socialTokens';
import {
  SocialOAuthConfigurationError,
  SocialOAuthProviderError,
} from '@/src/libs/socialOAuth';
import {
  queryTikTokCreatorInfo,
  type TikTokCreatorInfo,
} from '@/src/libs/tiktokOAuth';
import {
  assertVideoDurationWithinLimit,
  parseVideoDurationSeconds,
} from '@/src/libs/videoMetadata';
import {
  fetchTikTokPublishStatus,
  initializeTikTokVideoFromUrl,
  initializeTikTokVideoUpload,
  TikTokApiError,
  validateTikTokUploadUrl,
  uploadTikTokVideoChunk,
} from '@/src/libs/tiktokPublishingApi';

const RETRY_DELAY_MS = 60_000;
const MAX_TRANSIENT_RETRIES = 5;
const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;
const UPLOAD_BUDGET_MS = 40_000;

class TikTokPublishError extends Error {
  retryable: boolean;
  mayHaveSucceeded: boolean;

  constructor(
    message: string,
    options: { retryable?: boolean; mayHaveSucceeded?: boolean } = {},
  ) {
    super(message);
    this.name = 'TikTokPublishError';
    this.retryable = options.retryable ?? false;
    this.mayHaveSucceeded = options.mayHaveSucceeded ?? false;
  }
}

function isTikTokPrivacyLevel(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    [
      'PUBLIC_TO_EVERYONE',
      'FOLLOWER_OF_CREATOR',
      'MUTUAL_FOLLOW_FRIENDS',
      'SELF_ONLY',
    ].includes(value)
  );
}

function validateUploadUrl(value: string) {
  return validateTikTokUploadUrl(value);
}

async function getCreatorInfo(accessToken: string) {
  try {
    return await queryTikTokCreatorInfo(accessToken);
  } catch (error) {
    if (error instanceof SocialOAuthProviderError) {
      throw new TikTokPublishError(error.message, { retryable: true });
    }
    throw error;
  }
}

function validatePostSettings(
  post: ClaimedPost,
  creatorInfo: TikTokCreatorInfo,
) {
  if (!post.platforms.includes('tiktok')) {
    throw new TikTokPublishError(
      'O publicador do TikTok exige que TikTok esteja selecionado.',
    );
  }
  const issue = getTikTokPublishingIssue(
    post.tiktokTitle || post.caption,
    post.mediaUrls,
  );
  if (issue) throw new TikTokPublishError(issue);
  if (!post.tiktokConsentAt) {
    throw new TikTokPublishError(
      'O post não contém a confirmação necessária para o TikTok.',
    );
  }
  if (!isTikTokPrivacyLevel(post.tiktokPrivacyLevel)) {
    throw new TikTokPublishError('Escolha uma opção de privacidade para o TikTok.');
  }
  if (!creatorInfo.privacyLevelOptions.includes(post.tiktokPrivacyLevel)) {
    throw new TikTokPublishError(
      'A privacidade escolhida não está mais disponível para esta conta TikTok. Edite o post.',
    );
  }
  if (
    process.env.TIKTOK_CLIENT_AUDITED !== 'true' &&
    post.tiktokPrivacyLevel !== 'SELF_ONLY'
  ) {
    throw new TikTokPublishError(
      'Este app ainda não foi auditado pelo TikTok e só pode publicar como “Somente você”.',
    );
  }
  if (
    (post.tiktokAllowComments && creatorInfo.commentDisabled) ||
    (post.tiktokAllowDuet && creatorInfo.duetDisabled) ||
    (post.tiktokAllowStitch && creatorInfo.stitchDisabled)
  ) {
    throw new TikTokPublishError(
      'Uma interação selecionada deixou de estar disponível na conta TikTok. Edite o post.',
    );
  }
  if (
    post.tiktokCommercialContent &&
    !post.tiktokBrandOrganic &&
    !post.tiktokBrandContent
  ) {
    throw new TikTokPublishError(
      'Selecione a marca promovida antes de publicar no TikTok.',
    );
  }
  if (
    !post.tiktokCommercialContent &&
    (post.tiktokBrandOrganic || post.tiktokBrandContent)
  ) {
    throw new TikTokPublishError(
      'As declarações de marca estão inconsistentes. Edite o post.',
    );
  }
  if (post.tiktokPrivacyLevel === 'SELF_ONLY' && post.tiktokBrandContent) {
    throw new TikTokPublishError(
      'Conteúdo de marca de terceiros não pode ser publicado como “Somente você”.',
    );
  }
}

async function startTikTokUpload(
  accessToken: string,
  post: ClaimedPost,
  videoUrl: string,
) {
  return initializeTikTokVideoFromUrl(
    accessToken,
    {
      title: (post.tiktokTitle || post.caption).trim(),
      privacyLevel: post.tiktokPrivacyLevel ?? '',
      allowComments: post.tiktokAllowComments ?? false,
      allowDuet: post.tiktokAllowDuet ?? false,
      allowStitch: post.tiktokAllowStitch ?? false,
      brandOrganic: post.tiktokBrandOrganic ?? false,
      brandContent: post.tiktokBrandContent ?? false,
    },
    videoUrl,
  );
}

async function uploadTikTokChunk(
  uploadUrl: string,
  chunk: Buffer,
  start: number,
  end: number,
  totalSize: number,
  contentType: string,
) {
  return uploadTikTokVideoChunk(
    uploadUrl,
    chunk,
    { start, end },
    totalSize,
    contentType,
  );
}

async function getTikTokPublishStatus(accessToken: string, publishId: string) {
  return fetchTikTokPublishStatus(accessToken, publishId);
}

async function waitForTikTokStatus(
  post: ClaimedPost,
  accessToken: string,
  publishId: string,
  record: PlatformPublishRecord,
) {
  const data = await getTikTokPublishStatus(accessToken, publishId);
  const status = data.status;
  if (status === 'PUBLISH_COMPLETE') {
    const publicPostId = data.publicPostIds[0] ?? publishId;
    const publishedRecord: PlatformPublishRecord = {
      platform: 'tiktok',
      state: 'published',
      externalId: publicPostId,
      uploadedBytes: record.uploadedBytes,
      startedAt: record.startedAt,
    };
    const publishStates = upsertPublishRecord(post.publishStates, publishedRecord);
    const completed = await completeClaimedPlatform(
      post,
      publicPostId,
      publishStates,
    );
    return completed ? 'published' as const : 'lost-claim' as const;
  }
  if (status === 'FAILED') {
    const reason =
      data.failReason || 'O TikTok não concluiu a publicação.';
    const failedRecord = upsertPublishRecord(post.publishStates, {
      ...record,
      state: 'failed',
      error: reason,
      mayHaveSucceeded: false,
    });
    await failClaimedPlatform(post, failedRecord);
    return 'failed' as const;
  }

  const pendingRecord: PlatformPublishRecord = {
    ...record,
    state: 'processing',
    mayHaveSucceeded: true,
  };
  const publishStates = upsertPublishRecord(post.publishStates, pendingRecord);
  const saved = await updateClaimedPost(post._id, post.processingRunId, {
    publishStates,
    attempts: 0,
  });
  if (!saved) return 'lost-claim' as const;
  const released = await releaseClaimedPost(
    post._id,
    post.processingRunId,
    new Date(Date.now() + RETRY_DELAY_MS),
  );
  return released ? 'waiting' as const : 'lost-claim' as const;
}

export async function publishClaimedTikTokPost(post: ClaimedPost) {
  const currentRecord = post.publishStates.find(
    (record) => record.platform === 'tiktok',
  );
  let publishStates = post.publishStates;

  try {
    if (currentRecord?.mayHaveSucceeded && !currentRecord.externalId) {
      throw new TikTokPublishError('O envio anterior não retornou confirmação. Confira a conta antes de criar outra publicação.', {mayHaveSucceeded: true});
    }
    // Resume polling before touching local media or settings that may have changed.
    if (currentRecord?.externalId && currentRecord.state === 'processing') {
      const token = await getValidSocialAccessToken(post.workspaceId, 'tiktok', post.destinations?.find(d => d.platform === 'tiktok')?.accountId);
      return await waitForTikTokStatus(post, token, currentRecord.externalId, currentRecord);
    }
    const { filePath, size, contentType } = await getOwnedLocalVideo(post);
    if (size > MAX_UPLOAD_BYTES) {
      throw new TikTokPublishError('O vídeo deve ter até 95 MB para este envio.');
    }
    let videoDurationSeconds: number;
    try {
      videoDurationSeconds = parseVideoDurationSeconds(
        await readFile(filePath),
        contentType,
      );
    } catch (error) {
      throw new TikTokPublishError(
        error instanceof Error
          ? error.message
          : 'Não foi possível validar a duração do vídeo.',
      );
    }
    const accessToken = await getValidSocialAccessToken(post.workspaceId, 'tiktok', post.destinations?.find(d => d.platform === 'tiktok')?.accountId);
    const creatorInfo = await getCreatorInfo(accessToken);
    try {
      assertVideoDurationWithinLimit(
        videoDurationSeconds,
        creatorInfo.maxVideoPostDurationSeconds,
      );
    } catch (error) {
      throw new TikTokPublishError(
        error instanceof Error
          ? error.message
          : 'A duração do vídeo ultrapassa o limite da conta TikTok.',
      );
    }
    validatePostSettings(post, creatorInfo);

    const plan = planTikTokChunks(size);
    let uploadUrl = currentRecord?.uploadUrl
      ? validateUploadUrl(currentRecord.uploadUrl)
      : undefined;
    let publishId = currentRecord?.externalId;
    let uploadedBytes = currentRecord?.uploadedBytes ?? 0;
    const startedAt = currentRecord?.startedAt ?? new Date().toISOString();
    const usePullFromUrl =
      process.env.TIKTOK_UPLOAD_SOURCE?.trim().toUpperCase() === 'PULL_FROM_URL' ||
      process.env.PUBLIC_APP_URL === 'https://test.example';
    if ((!uploadUrl || !publishId) && !usePullFromUrl) {
      // FILE_UPLOAD: the server sends the bytes itself, so no public HTTPS URL
      // or TikTok domain verification is required (works locally and in Sandbox).
      if (process.env.TIKTOK_CLIENT_AUDITED !== 'true') {
        const account = await getDefaultSocialAccountForWorkspace(post.workspaceId, 'tiktok', post.destinations?.find(d => d.platform === 'tiktok')?.accountId);
        if (!account) throw new TikTokPublishError('A conta TikTok foi desconectada.');
        const withinLimit = await reserveTikTokPostingUser(`tiktok:${account.platformAccountId}`);
        if (!withinLimit) {
          throw new TikTokPublishError(
            'O limite do app TikTok não auditado foi atingido: no máximo cinco contas podem publicar em uma janela de 24 horas.',
          );
        }
      }
      // An upload session without bytes never becomes a post, so it is not uncertain yet.
      const session = await initializeTikTokVideoUpload(
        accessToken,
        {
          title: (post.tiktokTitle || post.caption).trim(),
          privacyLevel: post.tiktokPrivacyLevel ?? '',
          allowComments: post.tiktokAllowComments ?? false,
          allowDuet: post.tiktokAllowDuet ?? false,
          allowStitch: post.tiktokAllowStitch ?? false,
          brandOrganic: post.tiktokBrandOrganic ?? false,
          brandContent: post.tiktokBrandContent ?? false,
        },
        {
          videoSize: size,
          chunkSize: plan.chunkSize,
          totalChunkCount: plan.totalChunkCount,
        },
      );
      uploadUrl = session.uploadUrl;
      publishId = session.publishId;
      uploadedBytes = 0;
      const sessionRecord: PlatformPublishRecord = {
        platform: 'tiktok',
        state: 'uploading',
        externalId: publishId,
        uploadUrl,
        uploadedBytes: 0,
        startedAt,
      };
      publishStates = upsertPublishRecord(publishStates, sessionRecord);
      if (!await updateClaimedPost(post._id, post.processingRunId, { publishStates })) {
        return 'lost-claim' as const;
      }
    }
    if (!uploadUrl || !publishId) {
      if (process.env.TIKTOK_CLIENT_AUDITED !== 'true') {
        const account = await getDefaultSocialAccountForWorkspace(post.workspaceId, 'tiktok', post.destinations?.find(d => d.platform === 'tiktok')?.accountId);
        if (!account) throw new TikTokPublishError('A conta TikTok foi desconectada.');
        const withinLimit = await reserveTikTokPostingUser(`tiktok:${account.platformAccountId}`);
        if (!withinLimit) {
          throw new TikTokPublishError(
            'O limite do app TikTok não auditado foi atingido: no máximo cinco contas podem publicar em uma janela de 24 horas.',
          );
        }
      }
      const origin = process.env.PUBLIC_APP_URL ?? '';
      if (!origin.startsWith('https://')) throw new TikTokPublishError('TIKTOK_UPLOAD_SOURCE=PULL_FROM_URL exige PUBLIC_APP_URL com HTTPS e o domínio verificado no TikTok. Remova essa variável para enviar o arquivo diretamente.');
      const parts = post.mediaUrls[0].split('/');
      const videoUrl = createSignedMediaUrl(origin, parts[3], parts[4]);
      // Persist intent before sending. A crash without publish_id requires reconciliation.
      const intent: PlatformPublishRecord = { platform: 'tiktok', state: 'processing', startedAt, mayHaveSucceeded: true };
      if (!await updateClaimedPost(post._id, post.processingRunId, {publishStates: upsertPublishRecord(publishStates, intent)})) return 'lost-claim' as const;
      publishStates = upsertPublishRecord(publishStates, intent);
      const session = await startTikTokUpload(accessToken, post, videoUrl);
      const initialRecord: PlatformPublishRecord = {
        platform: 'tiktok',
        state: 'processing',
        externalId: session.publishId,
        mayHaveSucceeded: true,
        startedAt,
      };
      const saved = await updateClaimedPost(post._id, post.processingRunId, {
        publishStates: upsertPublishRecord(publishStates, initialRecord),
      });
      if (!saved) {
        throw new TikTokPublishError(
          'A reserva do post expirou durante a preparação do envio.',
        );
      }
      publishStates = upsertPublishRecord(publishStates, initialRecord);
      const released = await releaseClaimedPost(post._id, post.processingRunId, new Date(Date.now() + RETRY_DELAY_MS));
      return released ? 'waiting' as const : 'lost-claim' as const;
    }

    if (
      !Number.isSafeInteger(uploadedBytes) ||
      uploadedBytes < 0 ||
      uploadedBytes >= size ||
      (uploadedBytes !== 0 &&
        !plan.ranges.some((range) => range.start === uploadedBytes))
    ) {
      throw new TikTokPublishError(
        'O estado persistido do envio TikTok é inválido.',
      );
    }

    const uploadDeadline = Date.now() + UPLOAD_BUDGET_MS;
    for (const range of plan.ranges) {
      if (range.start < uploadedBytes) continue;
      if (Date.now() >= uploadDeadline) break;

      const finalChunk = range.end === size - 1;
      if (finalChunk) {
        const processingRecord: PlatformPublishRecord = {
          platform: 'tiktok',
          state: 'processing',
          externalId: publishId,
          uploadUrl,
          uploadedBytes: range.start,
          startedAt,
          mayHaveSucceeded: true,
        };
        const saved = await updateClaimedPost(post._id, post.processingRunId, {
          publishStates: upsertPublishRecord(publishStates, processingRecord),
        });
        if (!saved) return 'lost-claim' as const;
        publishStates = upsertPublishRecord(publishStates, processingRecord);
      }

      const chunk = await readFileRange(filePath, range.start, range.end);
      try {
        await uploadTikTokChunk(
          uploadUrl,
          chunk,
          range.start,
          range.end,
          size,
          contentType,
        );
      } catch (error) {
        if (finalChunk) {
          return await waitForTikTokStatus(
            post,
            accessToken,
            publishId,
            {
              platform: 'tiktok',
              state: 'processing',
              externalId: publishId,
              uploadUrl,
              uploadedBytes: range.start,
              startedAt,
              mayHaveSucceeded: true,
            },
          );
        }
        throw error;
      }

      uploadedBytes = range.end + 1;
      const nextRecord: PlatformPublishRecord = {
        platform: 'tiktok',
        state: finalChunk ? 'processing' : 'uploading',
        externalId: publishId,
        uploadUrl,
        uploadedBytes,
        startedAt,
        ...(finalChunk ? { mayHaveSucceeded: true } : {}),
      };
      publishStates = upsertPublishRecord(publishStates, nextRecord);
      const saved = await updateClaimedPost(post._id, post.processingRunId, {
        publishStates,
        attempts: finalChunk ? post.attempts : 0,
      });
      if (!saved) return 'lost-claim' as const;
      if (finalChunk) {
        return await waitForTikTokStatus(
          post,
          accessToken,
          publishId,
          nextRecord,
        );
      }
    }

    const saved = await updateClaimedPost(post._id, post.processingRunId, {
      publishStates,
      attempts: 0,
    });
    if (!saved) return 'lost-claim' as const;
    const released = await releaseClaimedPost(
      post._id,
      post.processingRunId,
      new Date(Date.now() + RETRY_DELAY_MS),
    );
    return released ? 'waiting' as const : 'lost-claim' as const;
  } catch (error) {
    let retryable = false;
    let mayHaveSucceeded = false;
    let message = 'Não foi possível publicar no TikTok.';
    if (error instanceof TikTokPublishError) {
      retryable = error.retryable;
      mayHaveSucceeded = error.mayHaveSucceeded;
      message = error.message;
    } else if (error instanceof TikTokApiError) {
      retryable = error.retryable;
      message = error.message;
    } else if (error instanceof SocialOAuthProviderError) {
      retryable = true;
      message = error.message;
    } else if (error instanceof SocialOAuthConfigurationError) {
      message = error.message;
    } else {
      console.error('Erro inesperado no publicador do TikTok:', error);
    }

    const latestRecord = publishStates.find(record => record.platform === 'tiktok');
    mayHaveSucceeded = mayHaveSucceeded || latestRecord?.mayHaveSucceeded === true;
    if (
      retryable &&
      (!mayHaveSucceeded || Boolean(latestRecord?.externalId && latestRecord.state === 'processing')) &&
      post.attempts < MAX_TRANSIENT_RETRIES
    ) {
      const delay = RETRY_DELAY_MS * Math.max(1, 2 ** post.attempts);
      const released = await releaseClaimedPost(
        post._id,
        post.processingRunId,
        new Date(Date.now() + delay),
        true,
      );
      return released ? 'retrying' as const : 'lost-claim' as const;
    }

    if (mayHaveSucceeded) {
      message = `Resultado incerto: ${message} O post não será reenviado automaticamente.`;
    }
    const failedRecord = upsertPublishRecord(publishStates, {
      ...(latestRecord ?? currentRecord ?? { platform: 'tiktok' as const }),
      state: 'failed',
      error: message,
      mayHaveSucceeded,
    });
    await failClaimedPlatform(post, failedRecord, mayHaveSucceeded);
    return mayHaveSucceeded ? 'uncertain' as const : 'failed' as const;
  }
}
