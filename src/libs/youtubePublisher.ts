import 'server-only';

import { open } from 'fs/promises';
import path from 'path';
import {
  completeClaimedPlatform,
  failClaimedPlatform,
  releaseClaimedPost,
  updateClaimedPost,
  type ClaimedPost,
} from '@/src/data/posts';
import {
  getDefaultSocialAccountForWorkspace,
  updateSocialAccountTokens,
} from '@/src/data/socialAccounts';
import { decryptSocialToken } from '@/src/libs/socialTokenCrypto';
import {
  getMediaFilePath,
  getMediaOwnerKey,
} from '@/src/libs/mediaStorage';
import {
  getYouTubeMetadata,
  upsertPublishRecord,
  YOUTUBE_CHUNK_SIZE,
  YOUTUBE_MINIMUM_CHUNK_SIZE,
  type PlatformPublishRecord,
} from '@/src/libs/publishPlanning';
import {
  getYouTubeOAuthConfig,
  refreshYouTubeTokens,
} from '@/src/libs/youtubeOAuth';
import { SocialOAuthProviderError } from '@/src/libs/socialOAuth';

const RETRY_DELAY_MS = 60_000;
const MAX_TRANSIENT_RETRIES = 5;
const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;
const UPLOAD_BUDGET_MS = 45_000;

interface YouTubeVideo {
  id?: string;
}

class YouTubePublishError extends Error {
  retryable: boolean;
  mayHaveSucceeded: boolean;

  constructor(
    message: string,
    options: { retryable?: boolean; mayHaveSucceeded?: boolean } = {},
  ) {
    super(message);
    this.name = 'YouTubePublishError';
    this.retryable = options.retryable ?? false;
    this.mayHaveSucceeded = options.mayHaveSucceeded ?? false;
  }
}

function isYouTubeVideo(value: unknown): value is YouTubeVideo {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateUploadSessionUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new YouTubePublishError('O YouTube retornou uma URL de envio inválida.');
  }
  if (
    url.protocol !== 'https:' ||
    !['www.googleapis.com', 'youtube.googleapis.com'].includes(url.hostname) ||
    url.pathname !== '/upload/youtube/v3/videos' ||
    url.searchParams.get('uploadType') !== 'resumable' ||
    !url.searchParams.has('upload_id') ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new YouTubePublishError('O destino da sessão de envio do YouTube é inválido.');
  }
  return url.toString();
}

function getMediaDetails(post: ClaimedPost) {
  if (post.mediaUrls.length !== 1) {
    throw new YouTubePublishError(
      'O YouTube exige exatamente um arquivo de vídeo por publicação.',
    );
  }

  const match =
    /^\/api\/media\/([a-f\d]{64})\/([a-f\d-]{36}\.(?:mp4|mov|webm))$/i.exec(
      post.mediaUrls[0],
    );
  const allowedOwnerKeys = new Set([
    ...(post.mediaOwnerKeys ?? []),
    getMediaOwnerKey(post.userId),
    getMediaOwnerKey(post.workspaceId),
  ]);
  if (!match || !allowedOwnerKeys.has(match[1])) {
    throw new YouTubePublishError(
      'O post contém uma mídia de vídeo inválida ou de outra conta.',
    );
  }

  const ownerKey = match[1];
  const filename = match[2];
  const filePath = getMediaFilePath(ownerKey, filename);
  if (!filePath) {
    throw new YouTubePublishError('Não foi possível localizar o vídeo enviado.');
  }
  const extension = path.extname(filename).toLowerCase();
  const contentType =
    extension === '.mov'
      ? 'video/quicktime'
      : extension === '.webm'
        ? 'video/webm'
        : 'video/mp4';
  return { filePath, contentType };
}

async function getValidAccessToken(workspaceId: string) {
  const account = await getDefaultSocialAccountForWorkspace(workspaceId, 'youtube');
  if (!account) {
    throw new YouTubePublishError('Nenhuma conta padrão do YouTube está conectada.');
  }

  const expiresAt = account.accessTokenExpiresAt.getTime();
  if (!Number.isFinite(expiresAt)) {
    throw new YouTubePublishError('A conta padrão do YouTube possui uma expiração de token inválida.');
  }

  let accessToken: string;
  try {
    accessToken = decryptSocialToken(account.encryptedAccessToken);
  } catch {
    throw new YouTubePublishError('Não foi possível descriptografar o token do YouTube.');
  }

  if (expiresAt <= Date.now() + 60_000) {
    if (!account.encryptedRefreshToken) {
      throw new YouTubePublishError(
        'O token do YouTube expirou. Reconecte a conta antes de publicar.',
      );
    }

    let refreshToken: string;
    try {
      refreshToken = decryptSocialToken(account.encryptedRefreshToken);
    } catch {
      throw new YouTubePublishError(
        'Não foi possível descriptografar o token de renovação do YouTube.',
      );
    }

    const refreshed = await refreshYouTubeTokens(
      getYouTubeOAuthConfig(),
      refreshToken,
    );
    const updated = await updateSocialAccountTokens(
      workspaceId,
      'youtube',
      account.id,
      refreshed,
    );
    if (!updated) {
      throw new YouTubePublishError('Não foi possível salvar o token renovado do YouTube.');
    }
    accessToken = refreshed.accessToken;
  }

  return accessToken;
}

async function startResumableUpload(
  accessToken: string,
  caption: string,
  contentType: string,
  fileSize: number,
) {
  const metadata = getYouTubeMetadata(caption);
  const url = new URL('https://www.googleapis.com/upload/youtube/v3/videos');
  url.searchParams.set('uploadType', 'resumable');
  url.searchParams.set('part', 'snippet,status');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(fileSize),
        'X-Upload-Content-Type': contentType,
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title,
          description: metadata.description,
          categoryId: '22',
        },
        status: { privacyStatus: 'public' },
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new YouTubePublishError(
      'Falha ao iniciar o envio resumível do YouTube.',
      { retryable: true },
    );
  }

  if (!response.ok) {
    throw new YouTubePublishError(
      `O YouTube recusou o início do envio (HTTP ${response.status}).`,
      { retryable: response.status === 429 || response.status >= 500 },
    );
  }

  const uploadUrl = response.headers.get('location');
  if (!uploadUrl) {
    throw new YouTubePublishError(
      'O YouTube não retornou a URL da sessão de envio.',
    );
  }

  return validateUploadSessionUrl(uploadUrl);
}

function getFileChunk(
  file: Buffer,
  start: number,
  end: number,
) {
  return file.subarray(start, end);
}

async function uploadNextChunk(
  uploadUrl: string,
  accessToken: string,
  file: Buffer,
  start: number,
  contentType: string,
  timeoutMs: number,
) {
  const end = Math.min(start + YOUTUBE_CHUNK_SIZE, file.length);
  const chunk = getFileChunk(file, start, end);
  const requestBody = new Uint8Array(chunk.byteLength);
  requestBody.set(chunk);
  let response: Response;
  try {
    response = await fetch(validateUploadSessionUrl(uploadUrl), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Length': String(chunk.length),
        'Content-Type': contentType,
        'Content-Range': `bytes ${start}-${end - 1}/${file.length}`,
      },
      body: requestBody,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new YouTubePublishError(
      'A conexão foi interrompida durante o envio ao YouTube.',
      {
        retryable: true,
        mayHaveSucceeded: end === file.length,
      },
    );
  }

  if (response.status === 308) {
    const range = response.headers.get('range');
    const uploadedThrough = range
      ? /^bytes=0-(\d+)$/.exec(range)?.[1]
      : undefined;
    const uploadedBytes = uploadedThrough
      ? Number(uploadedThrough) + 1
      : 0;
    if (
      !Number.isSafeInteger(uploadedBytes) ||
      uploadedBytes < 0 ||
      uploadedBytes > file.length ||
      (uploadedBytes !== file.length &&
        uploadedBytes % YOUTUBE_MINIMUM_CHUNK_SIZE !== 0)
    ) {
      throw new YouTubePublishError(
        'O YouTube retornou uma posição de envio inválida.',
      );
    }
    return { complete: false as const, uploadedBytes };
  }

  if (response.status !== 200 && response.status !== 201) {
    throw new YouTubePublishError(
      `O YouTube recusou um bloco do vídeo (HTTP ${response.status}).`,
      {
        retryable: response.status === 429 || response.status >= 500,
        mayHaveSucceeded: end === file.length && response.status >= 500,
      },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new YouTubePublishError(
      'O YouTube concluiu o envio, mas retornou uma resposta inválida.',
      { mayHaveSucceeded: true },
    );
  }
  if (!isYouTubeVideo(body) || typeof body.id !== 'string' || !body.id) {
    throw new YouTubePublishError(
      'O YouTube concluiu o envio sem retornar o identificador do vídeo.',
      { mayHaveSucceeded: true },
    );
  }
  return { complete: true as const, videoId: body.id };
}

export async function publishClaimedYouTubePost(post: ClaimedPost) {
  let currentRecord = post.publishStates.find(
    (record) => record.platform === 'youtube',
  );
  if (currentRecord?.mayHaveSucceeded) {
    const message =
      'Resultado incerto: o worker foi interrompido durante o envio final ao YouTube. O vídeo não será reenviado automaticamente.';
    const failedRecord = upsertPublishRecord(post.publishStates, {
      ...currentRecord,
      state: 'failed',
      error: message,
      mayHaveSucceeded: true,
    });
    await failClaimedPlatform(post, failedRecord, true);
    return 'uncertain' as const;
  }

  let retryable = false;
  let mayHaveSucceeded = false;
  let publishStates = post.publishStates;
  try {
    if (!post.platforms.includes('youtube')) {
      throw new YouTubePublishError(
        'O publicador do YouTube exige que YouTube esteja selecionado.',
      );
    }

    const { filePath, contentType } = getMediaDetails(post);
    const fileHandle = await open(filePath, 'r');
    let file: Buffer;
    try {
      const fileInfo = await fileHandle.stat();
      if (!fileInfo.isFile() || fileInfo.size <= 0) {
        throw new YouTubePublishError('O arquivo de vídeo está vazio ou inválido.');
      }
      if (fileInfo.size > MAX_UPLOAD_BYTES) {
        throw new YouTubePublishError('O vídeo deve ter até 95 MB para este upload.');
      }
      file = Buffer.alloc(fileInfo.size);
      let offset = 0;
      while (offset < file.length) {
        const { bytesRead } = await fileHandle.read(
          file,
          offset,
          file.length - offset,
          offset,
        );
        if (bytesRead === 0) {
          throw new YouTubePublishError('Não foi possível ler o arquivo de vídeo completo.');
        }
        offset += bytesRead;
      }
    } finally {
      await fileHandle.close();
    }

    const accessToken = await getValidAccessToken(post.workspaceId);
    let uploadUrl = currentRecord?.uploadUrl
      ? validateUploadSessionUrl(currentRecord.uploadUrl)
      : undefined;
    let uploadedBytes = currentRecord?.uploadedBytes ?? 0;
    if (!uploadUrl) {
      uploadUrl = await startResumableUpload(
        accessToken,
        post.caption,
        contentType,
        file.length,
      );
      const initialRecord: PlatformPublishRecord = {
        platform: 'youtube',
        state: 'uploading',
        uploadUrl,
        uploadedBytes: 0,
        startedAt: new Date().toISOString(),
      };
      const saved = await updateClaimedPost(post._id, post.processingRunId, {
        publishStates: upsertPublishRecord(publishStates, initialRecord),
      });
      if (!saved) throw new YouTubePublishError('A reserva do post expirou durante a preparação.');
      publishStates = upsertPublishRecord(publishStates, initialRecord);
      currentRecord = initialRecord;
    }

    if (
      !Number.isSafeInteger(uploadedBytes) ||
      uploadedBytes < 0 ||
      uploadedBytes >= file.length ||
      (uploadedBytes !== 0 &&
        uploadedBytes % YOUTUBE_MINIMUM_CHUNK_SIZE !== 0)
    ) {
      throw new YouTubePublishError('O estado persistido do envio ao YouTube é inválido.');
    }

    const uploadDeadline = Date.now() + UPLOAD_BUDGET_MS;
    while (uploadedBytes < file.length) {
      const finalChunk =
        Math.min(uploadedBytes + YOUTUBE_CHUNK_SIZE, file.length) === file.length;
      if (finalChunk) {
        const finalRecord: PlatformPublishRecord = {
          platform: 'youtube',
          state: 'processing',
          uploadUrl,
          uploadedBytes,
          startedAt: currentRecord?.startedAt ?? new Date().toISOString(),
          mayHaveSucceeded: true,
        };
        const nextStates = upsertPublishRecord(publishStates, finalRecord);
        const saved = await updateClaimedPost(post._id, post.processingRunId, {
          publishStates: nextStates,
        });
        if (!saved) throw new YouTubePublishError('A reserva do post expirou antes do envio final.');
        publishStates = nextStates;
        currentRecord = finalRecord;
      }

      const remainingBudget = uploadDeadline - Date.now();
      if (remainingBudget <= 0) break;
      const result = await uploadNextChunk(
        uploadUrl,
        accessToken,
        file,
        uploadedBytes,
        contentType,
        Math.min(20_000, remainingBudget),
      );
      if (result.complete) {
        const publishedRecord: PlatformPublishRecord = {
          platform: 'youtube',
          state: 'published',
          externalId: result.videoId,
          uploadedBytes: file.length,
          startedAt: currentRecord?.startedAt ?? new Date().toISOString(),
        };
        publishStates = upsertPublishRecord(publishStates, publishedRecord);
        const completed = await completeClaimedPlatform(
          post,
          result.videoId,
          publishStates,
        );
        return completed ? 'published' as const : 'lost-claim' as const;
      }

      if (result.uploadedBytes === file.length) {
        throw new YouTubePublishError(
          'O YouTube confirmou todos os bytes, mas não concluiu a publicação.',
          { mayHaveSucceeded: true },
        );
      }
      if (result.uploadedBytes === uploadedBytes) {
        const uploadState: PlatformPublishRecord = {
          platform: 'youtube',
          state: 'uploading',
          uploadUrl,
          uploadedBytes,
          startedAt: currentRecord?.startedAt ?? new Date().toISOString(),
        };
        publishStates = upsertPublishRecord(publishStates, uploadState);
        const saved = await updateClaimedPost(post._id, post.processingRunId, {
          publishStates,
        });
        if (!saved) return 'lost-claim' as const;
        currentRecord = uploadState;
        break;
      }
      uploadedBytes = result.uploadedBytes;
      const uploadState: PlatformPublishRecord = {
        platform: 'youtube',
        state: 'uploading',
        uploadUrl,
        uploadedBytes,
        startedAt: currentRecord?.startedAt ?? new Date().toISOString(),
      };
      publishStates = upsertPublishRecord(publishStates, uploadState);
      const saved = await updateClaimedPost(post._id, post.processingRunId, {
        publishStates,
        attempts: 0,
      });
      if (!saved) return 'lost-claim' as const;
      currentRecord = uploadState;
    }

    const released = await releaseClaimedPost(
      post._id,
      post.processingRunId,
      new Date(Date.now() + RETRY_DELAY_MS),
    );
    return released ? 'waiting' as const : 'lost-claim' as const;
  } catch (error) {
    if (error instanceof YouTubePublishError) {
      retryable = error.retryable;
      mayHaveSucceeded = error.mayHaveSucceeded;
    } else if (error instanceof SocialOAuthProviderError) {
      retryable = true;
    } else {
      console.error('Erro inesperado no publicador do YouTube:', error);
    }

    const attempts = post.attempts;
    if (retryable && !mayHaveSucceeded && attempts < MAX_TRANSIENT_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.max(1, 2 ** attempts);
      const released = await releaseClaimedPost(
        post._id,
        post.processingRunId,
        new Date(Date.now() + delay),
        true,
      );
      if (released) return 'retry' as const;
      return 'lost-claim' as const;
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Falha inesperada ao publicar no YouTube.';
    const failedRecord = upsertPublishRecord(publishStates, {
      platform: 'youtube',
      state: 'failed',
      error: message,
      mayHaveSucceeded,
      ...(currentRecord?.uploadUrl ? { uploadUrl: currentRecord.uploadUrl } : {}),
      ...(currentRecord?.uploadedBytes !== undefined
        ? { uploadedBytes: currentRecord.uploadedBytes }
        : {}),
      ...(currentRecord?.startedAt ? { startedAt: currentRecord.startedAt } : {}),
    });
    await failClaimedPlatform(post, failedRecord, mayHaveSucceeded);
    return mayHaveSucceeded ? 'uncertain' as const : 'failed' as const;
  }
}
