const TIKTOK_API_ROOT = 'https://open.tiktokapis.com/v2/post/publish/';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export class TikTokApiError extends Error {
  retryable: boolean;

  constructor(
    message: string,
    options: { retryable?: boolean } = {},
  ) {
    super(message);
    this.name = 'TikTokApiError';
    this.retryable = options.retryable ?? false;
  }
}

export interface TikTokPostInfo {
  title: string;
  privacyLevel: string;
  allowComments: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  brandOrganic: boolean;
  brandContent: boolean;
}

export interface TikTokUploadSession {
  publishId: string;
  uploadUrl: string;
}

export interface TikTokPublishStatus {
  status: string;
  failReason?: string;
  publicPostIds: string[];
  uploadedBytes?: number;
}

function retryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

export function validateTikTokUploadUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TikTokApiError('O TikTok retornou uma URL de envio inválida.');
  }
  if (
    url.toString().length > 2048 ||
    url.protocol !== 'https:' ||
    !/^open-upload(-[a-z0-9]+)*\.tiktokapis\.com$/.test(url.hostname) ||
    url.pathname !== '/video/' ||
    url.username ||
    url.password ||
    url.port ||
    url.hash
  ) {
    throw new TikTokApiError('O destino da sessão de envio do TikTok é inválido.');
  }
  return url.toString();
}

async function requestJson(
  fetcher: typeof fetch,
  url: URL,
  init: RequestInit,
  fallback: string,
) {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new TikTokApiError(
      'Não foi possível acessar a API de publicação do TikTok.',
      { retryable: true },
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const error =
    isRecord(body) && isRecord(body.error) ? body.error : undefined;
  if (
    !response.ok ||
    !error ||
    error.code !== 'ok' ||
    !isRecord(body) ||
    !isRecord(body.data)
  ) {
    const message =
      error && typeof error.message === 'string' && error.message
        ? error.message
        : fallback;
    throw new TikTokApiError(message, {
      retryable: retryableStatus(response.status),
    });
  }
  return body.data;
}

export async function initializeTikTokVideoUpload(
  accessToken: string,
  postInfo: TikTokPostInfo,
  sourceInfo: {
    videoSize: number;
    chunkSize: number;
    totalChunkCount: number;
  },
  fetcher: typeof fetch = fetch,
): Promise<TikTokUploadSession> {
  const data = await requestJson(
    fetcher,
    new URL(`${TIKTOK_API_ROOT}video/init/`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: postInfo.title,
          privacy_level: postInfo.privacyLevel,
          disable_comment: !postInfo.allowComments,
          disable_duet: !postInfo.allowDuet,
          disable_stitch: !postInfo.allowStitch,
          brand_organic_toggle: postInfo.brandOrganic,
          brand_content_toggle: postInfo.brandContent,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: sourceInfo.videoSize,
          chunk_size: sourceInfo.chunkSize,
          total_chunk_count: sourceInfo.totalChunkCount,
        },
      }),
    },
    'O TikTok não iniciou o envio do vídeo.',
  );
  if (
    typeof data.publish_id !== 'string' ||
    data.publish_id.length === 0 ||
    data.publish_id.length > 256 ||
    typeof data.upload_url !== 'string'
  ) {
    throw new TikTokApiError(
      'O TikTok retornou dados inválidos para a sessão de envio.',
    );
  }
  return {
    publishId: data.publish_id,
    uploadUrl: validateTikTokUploadUrl(data.upload_url),
  };
}

/** Server-hosted media must be downloaded by TikTok from a verified domain. */
export async function initializeTikTokVideoFromUrl(
  accessToken: string,
  postInfo: TikTokPostInfo,
  videoUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ publishId: string }> {
  const url = new URL(videoUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new TikTokApiError('O vídeo do TikTok precisa de uma URL HTTPS pública no domínio verificado.');
  }
  const data = await requestJson(fetcher, new URL(`${TIKTOK_API_ROOT}video/init/`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: {
        title: postInfo.title,
        privacy_level: postInfo.privacyLevel,
        disable_comment: !postInfo.allowComments,
        disable_duet: !postInfo.allowDuet,
        disable_stitch: !postInfo.allowStitch,
        brand_organic_toggle: postInfo.brandOrganic,
        brand_content_toggle: postInfo.brandContent,
      },
      source_info: { source: 'PULL_FROM_URL', video_url: url.toString() },
    }),
  }, 'O TikTok não confirmou o início da publicação por URL.');
  if (typeof data.publish_id !== 'string' || !data.publish_id || data.publish_id.length > 64) {
    throw new TikTokApiError('O TikTok não retornou um identificador válido de publicação.');
  }
  return { publishId: data.publish_id };
}

export async function uploadTikTokVideoChunk(
  uploadUrl: string,
  chunk: Buffer,
  range: { start: number; end: number },
  totalSize: number,
  contentType: string,
  fetcher: typeof fetch = fetch,
) {
  if (
    !Number.isSafeInteger(range.start) ||
    !Number.isSafeInteger(range.end) ||
    !Number.isSafeInteger(totalSize) ||
    range.start < 0 ||
    range.end < range.start ||
    range.end >= totalSize ||
    chunk.length !== range.end - range.start + 1
  ) {
    throw new TikTokApiError('O bloco enviado ao TikTok possui um intervalo inválido.');
  }
  const body = new Uint8Array(chunk.byteLength);
  body.set(chunk);
  let response: Response;
  try {
    response = await fetcher(validateTikTokUploadUrl(uploadUrl), {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Type': contentType,
        'Content-Range': `bytes ${range.start}-${range.end}/${totalSize}`,
      },
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new TikTokApiError(
      'A conexão foi interrompida durante o envio ao TikTok.',
      { retryable: true },
    );
  }
  if (!response.ok) {
    throw new TikTokApiError(
      `O TikTok recusou um bloco do vídeo (HTTP ${response.status}).`,
      { retryable: retryableStatus(response.status) },
    );
  }
}

export async function fetchTikTokPublishStatus(
  accessToken: string,
  publishId: string,
  fetcher: typeof fetch = fetch,
): Promise<TikTokPublishStatus> {
  const data = await requestJson(
    fetcher,
    new URL(`${TIKTOK_API_ROOT}status/fetch/`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
    },
    'Não foi possível consultar o estado da publicação TikTok.',
  );
  if (typeof data.status !== 'string' || !data.status) {
    throw new TikTokApiError(
      'O TikTok retornou um estado de publicação inválido.',
    );
  }
  const rawIds =
    data.publicly_available_post_id ?? data.publicaly_available_post_id;
  return {
    status: data.status,
    ...(typeof data.fail_reason === 'string'
      ? { failReason: data.fail_reason }
      : {}),
    publicPostIds:
      Array.isArray(rawIds) && rawIds.every((id) => typeof id === 'string')
        ? rawIds
        : [],
    ...(typeof data.uploaded_bytes === 'number' &&
    Number.isSafeInteger(data.uploaded_bytes)
      ? { uploadedBytes: data.uploaded_bytes }
      : {}),
  };
}
