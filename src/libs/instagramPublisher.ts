import 'server-only';

import {
  completeClaimedPlatform,
  failClaimedPlatform,
  releaseClaimedPost,
  updateClaimedPost,
  type ClaimedPost,
} from '@/src/data/posts';
import { upsertPublishRecord } from '@/src/libs/publishPlanning';
import {
  getDefaultInstagramAccountForWorkspace,
  updateInstagramAccountToken,
} from '@/src/data/accounts';
import {
  createSignedMediaUrl,
  getMediaOwnerKey,
} from '@/src/libs/mediaStorage';
import {
  getInstagramOAuthConfig,
  refreshInstagramLongLivedToken,
} from '@/src/libs/instagramOAuth';
import { decryptSocialToken, encryptSocialToken } from '@/src/libs/socialTokenCrypto';

const MAX_TRANSIENT_RETRIES = 5;
const RETRY_DELAY_MS = 60_000;

interface GraphRecord {
  id?: string;
  status_code?: string;
  error?: {
    code?: number;
  };
}

export class InstagramPublishError extends Error {
  retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = 'InstagramPublishError';
    this.retryable = retryable;
  }
}

function isGraphRecord(value: unknown): value is GraphRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getGraphUrl(path: string) {
  const { graphApiVersion } = getInstagramOAuthConfig();
  const safePath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return new URL(`https://graph.instagram.com/${graphApiVersion}/${safePath}`);
}

async function graphRequest(
  path: string,
  accessToken: string,
  fields: Record<string, string>,
): Promise<GraphRecord> {
  const url = getGraphUrl(path);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams({ ...fields, access_token: accessToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new InstagramPublishError(
      'Falha de comunicação com a API do Instagram.',
      true,
    );
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new InstagramPublishError(
      'A API do Instagram retornou uma resposta inválida.',
      response.status >= 500,
    );
  }

  if (!response.ok) {
    const code = isGraphRecord(value) && isGraphRecord(value.error)
      ? value.error.code
      : undefined;
    throw new InstagramPublishError(
      `A API do Instagram recusou a publicação${code ? ` (código ${code})` : ''}.`,
      response.status === 429 || response.status >= 500,
    );
  }

  if (!isGraphRecord(value)) {
    throw new InstagramPublishError('Resposta inválida da API do Instagram.');
  }
  return value;
}

function getMediaUrls(post: ClaimedPost) {
  if (post.mediaUrls.length === 0 || post.mediaUrls.length > 10) {
    throw new InstagramPublishError(
      'O Instagram exige mídia e aceita no máximo 10 arquivos por publicação.',
    );
  }
  const publicOrigin = process.env.PUBLIC_APP_URL;
  if (!publicOrigin) {
    throw new InstagramPublishError('PUBLIC_APP_URL não está configurada no servidor.');
  }
  const allowedOwnerKeys = new Set([
    ...(post.mediaOwnerKeys ?? []),
    getMediaOwnerKey(post.userId),
    getMediaOwnerKey(post.workspaceId),
  ]);

  return post.mediaUrls.map((mediaUrl) => {
    let url: URL;
    try {
      url = new URL(mediaUrl, publicOrigin);
    } catch {
      throw new InstagramPublishError('O post contém uma URL de mídia inválida.');
    }

    const match = /^\/api\/media\/([a-f\d]{64})\/([a-f\d-]{36}\.(?:jpg|png|webp|gif|mp4|mov|webm))$/i.exec(
      url.pathname,
    );
    if (
      url.origin !== new URL(publicOrigin).origin ||
      !match ||
      !allowedOwnerKeys.has(match[1]) ||
      url.search ||
      url.hash
    ) {
      throw new InstagramPublishError('O post contém uma mídia que não pertence à conta.');
    }

    const extension = match[2].split('.').pop()?.toLowerCase();
    const type: 'video' | 'image' | null =
      extension === 'mp4' || extension === 'mov' ? 'video' :
      extension === 'jpg' ? 'image' : null;
    if (!type) {
      throw new InstagramPublishError(
        'O Instagram aceita imagens JPG e vídeos MP4 ou MOV para publicação via API.',
      );
    }

    return {
      type,
      url: createSignedMediaUrl(publicOrigin, match[1], match[2]),
    };
  });
}

async function getValidAccessToken(workspaceId: string) {
  const account = await getDefaultInstagramAccountForWorkspace(workspaceId);
  if (!account) {
    throw new InstagramPublishError('Nenhuma conta padrão do Instagram está conectada.');
  }
  if (!/^\d+$/.test(account.platformAccountId)) {
    throw new InstagramPublishError('A conta padrão do Instagram possui um identificador inválido.');
  }

  const now = Date.now();
  const expiresAt = new Date(account.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new InstagramPublishError(
      'O token do Instagram expirou. Reconecte a conta antes de publicar.',
    );
  }

  const tokenAge = now - new Date(account.tokenIssuedAt).getTime();
  let accessToken: string;
  try {
    accessToken = decryptSocialToken(account.encryptedAccessToken);
  } catch {
    throw new InstagramPublishError('Não foi possível descriptografar o token do Instagram.');
  }

  if (expiresAt - now < 7 * 24 * 60 * 60 * 1000 && tokenAge >= 24 * 60 * 60 * 1000) {
    const refreshed = await refreshInstagramLongLivedToken(
      getInstagramOAuthConfig(),
      accessToken,
    );
    const tokenIssuedAt = new Date();
    const refreshedExpiry = new Date(
      tokenIssuedAt.getTime() + refreshed.expires_in * 1000,
    );
    const updated = await updateInstagramAccountToken(
      workspaceId,
      account.id,
      encryptSocialToken(refreshed.access_token),
      tokenIssuedAt,
      refreshedExpiry,
    );
    if (!updated) {
      throw new InstagramPublishError('Não foi possível salvar o token renovado do Instagram.');
    }
    accessToken = refreshed.access_token;
  }
  return { accessToken, instagramAccountId: account.platformAccountId };
}

async function getContainerStatus(containerId: string, accessToken: string) {
  const url = getGraphUrl(containerId);
  url.searchParams.set('fields', 'status_code');
  url.searchParams.set('access_token', accessToken);

  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new InstagramPublishError('Falha ao consultar o processamento da mídia.', true);
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new InstagramPublishError('Resposta inválida ao consultar a mídia.', response.status >= 500);
  }
  if (!response.ok || !isGraphRecord(value)) {
    throw new InstagramPublishError(
      'Não foi possível consultar o processamento da mídia no Instagram.',
      response.status === 429 || response.status >= 500,
    );
  }
  if (value.status_code === 'ERROR' || value.status_code === 'EXPIRED') {
    throw new InstagramPublishError('O Instagram não conseguiu processar a mídia enviada.');
  }
  if (value.status_code === 'FINISHED') return true;
  if (value.status_code === 'IN_PROGRESS') return false;
  throw new InstagramPublishError(
    'O Instagram retornou um estado de processamento de mídia desconhecido.',
  );
}

async function createMediaContainer(
  accountId: string,
  media: { type: 'image' | 'video'; url: string },
  accessToken: string,
  caption?: string,
  carouselItem = false,
) {
  const fields: Record<string, string> = {};
  if (media.type === 'image') {
    fields.image_url = media.url;
    fields.media_type = 'IMAGE';
  } else {
    fields.video_url = media.url;
    fields.media_type = carouselItem ? 'VIDEO' : 'REELS';
    if (!carouselItem) fields.share_to_feed = 'true';
  }
  if (carouselItem) fields.is_carousel_item = 'true';
  if (caption) fields.caption = caption;

  const response = await graphRequest(`${accountId}/media`, accessToken, fields);
  if (typeof response.id !== 'string' || !response.id) {
    throw new InstagramPublishError('O Instagram não retornou o identificador da mídia.');
  }
  return response.id;
}

async function prepareContainer(
  post: ClaimedPost,
  instagramAccountId: string,
  accessToken: string,
) {
  const media = getMediaUrls(post);
  let containerIds = post.instagramContainerIds;
  const isCarousel = media.length > 1;

  if (containerIds.length === 0) {
    if (isCarousel) {
      containerIds = await Promise.all(
        media.map((item) =>
          createMediaContainer(
            instagramAccountId,
            item,
            accessToken,
            undefined,
            true,
          ),
        ),
      );
    } else {
      containerIds = [
        await createMediaContainer(
          instagramAccountId,
          media[0],
          accessToken,
          post.caption,
        ),
      ];
    }
    const saved = await updateClaimedPost(post._id, post.processingRunId, {
      instagramContainerIds: containerIds,
      publisherState: 'container_ready',
    });
    if (!saved) throw new InstagramPublishError('A reserva do post expirou durante a preparação.');
    return null;
  }

  if (isCarousel && containerIds.length === media.length) {
    const childrenReady = await Promise.all(
      containerIds.map((childId) => getContainerStatus(childId, accessToken)),
    );
    if (childrenReady.some((ready) => !ready)) return null;
    const parent = await graphRequest(`${instagramAccountId}/media`, accessToken, {
      media_type: 'CAROUSEL',
      children: containerIds.join(','),
      caption: post.caption,
    });
    if (typeof parent.id !== 'string' || !parent.id) {
      throw new InstagramPublishError('O Instagram não retornou o identificador do carrossel.');
    }
    containerIds = [...containerIds, parent.id];
    const saved = await updateClaimedPost(post._id, post.processingRunId, {
      instagramContainerIds: containerIds,
    });
    if (!saved) throw new InstagramPublishError('A reserva do post expirou durante a preparação.');
    return null;
  }

  const publishContainerId = containerIds[containerIds.length - 1];
  if (!(await getContainerStatus(publishContainerId, accessToken))) return null;
  return publishContainerId;
}

export async function publishClaimedInstagramPost(post: ClaimedPost) {
  const runId = post.processingRunId;
  let publishingStarted = post.publisherState === 'publishing';
  try {
    if (!post.platforms.includes('instagram')) {
      throw new InstagramPublishError(
        'Este worker publica somente no Instagram.',
      );
    }
    if (post.publisherState === 'publishing') {
      const failedStates = upsertPublishRecord(post.publishStates, {
        platform: 'instagram',
        state: 'failed',
        error:
          'Resultado incerto: o worker foi interrompido durante a publicação. O post não será reenviado automaticamente para evitar duplicidade.',
        mayHaveSucceeded: true,
      });
      await failClaimedPlatform(
        post,
        failedStates,
        true,
      );
      return 'uncertain' as const;
    }

    const { accessToken, instagramAccountId } = await getValidAccessToken(post.workspaceId);
    const containerId = await prepareContainer(
      post,
      instagramAccountId,
      accessToken,
    );
    if (!containerId) {
      const released = await releaseClaimedPost(
        post._id,
        runId,
        new Date(Date.now() + RETRY_DELAY_MS),
      );
      return released ? 'waiting' as const : 'lost-claim' as const;
    }

    const saved = await updateClaimedPost(post._id, runId, {
      publisherState: 'publishing',
    });
    if (!saved) return 'lost-claim' as const;
    publishingStarted = true;

    const result = await graphRequest(
      `${instagramAccountId}/media_publish`,
      accessToken,
      { creation_id: containerId },
    );
    if (typeof result.id !== 'string' || !result.id) {
      throw new InstagramPublishError(
        'A Meta não confirmou o identificador da publicação.',
      );
    }
    const publishStates = upsertPublishRecord(post.publishStates, {
      platform: 'instagram',
      state: 'published',
      externalId: result.id,
      startedAt: new Date().toISOString(),
    });
    const completed = await completeClaimedPlatform(
      post,
      result.id,
      publishStates,
    );
    return completed ? 'published' as const : 'lost-claim' as const;
  } catch (error) {
    if (error instanceof InstagramPublishError && error.retryable && !publishingStarted) {
      if (post.attempts < MAX_TRANSIENT_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.max(1, 2 ** post.attempts);
        const released = await releaseClaimedPost(
          post._id,
          runId,
          new Date(Date.now() + delay),
          true,
        );
        return released ? 'retry' as const : 'lost-claim' as const;
      }
    }

    const message = error instanceof InstagramPublishError
      ? error.message
      : 'Falha inesperada ao publicar no Instagram.';
    if (!(error instanceof InstagramPublishError)) {
      console.error('Erro inesperado no publicador do Instagram:', error);
    }
    const failedStates = upsertPublishRecord(post.publishStates, {
      platform: 'instagram',
      state: 'failed',
      error: message,
      mayHaveSucceeded: publishingStarted,
    });
    await failClaimedPlatform(post, failedStates, publishingStarted);
    return publishingStarted ? 'uncertain' as const : 'failed' as const;
  }
}
