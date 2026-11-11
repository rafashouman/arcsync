export class FacebookPublishError extends Error {
  constructor(message: string, public mayHaveSucceeded = false) { super(message); }
}

export type FacebookPageMedia = { type: 'photo' | 'video'; url: string };

export async function publishFacebookPagePost(pageId: string, token: string, version: string, message: string, media?: FacebookPageMedia, fetcher: typeof fetch = fetch) {
  if (!/^\d+$/.test(pageId) || !/^v\d+\.0$/.test(version)) throw new FacebookPublishError('Destino do Facebook inválido.');
  const edge = media?.type === 'photo' ? 'photos' : media?.type === 'video' ? 'videos' : 'feed';
  const isVideo = media?.type === 'video';
  const body = media?.type === 'video'
    ? new URLSearchParams({
      file_url: media.url,
      description: message,
      published: 'true',
    }).toString()
    : media?.type === 'photo'
      ? JSON.stringify({ url: media.url, caption: message, published: 'true' })
      : JSON.stringify({ message, published: 'true' });
  let response: Response;
  try {
    response = await fetcher(`https://graph.facebook.com/${version}/${pageId}/${edge}`, {
      method:'POST',
      headers:{
        Authorization:`Bearer ${token}`,
        'Content-Type':isVideo ? 'application/x-www-form-urlencoded' : 'application/json',
      },
      body,
      cache:'no-store',redirect:'error',signal:AbortSignal.timeout(isVideo ? 120_000 : 20_000),
    });
  } catch { throw new FacebookPublishError('O Facebook não confirmou o resultado do envio.', true); }
  const responseBody: unknown = await response.json().catch(() => null);
  if (!response.ok && response.status < 500 && response.status !== 408 &&
      typeof responseBody === 'object' && responseBody !== null && 'error' in responseBody &&
      typeof responseBody.error === 'object' && responseBody.error !== null &&
      'code' in responseBody.error && responseBody.error.code === 190) {
    throw new FacebookPublishError('O Facebook recusou a autorização da Página. Reconecte a conta antes de publicar.');
  }
  if (!response.ok) throw new FacebookPublishError(`O Facebook recusou a publicação (HTTP ${response.status}). Confira permissões, mídia e conexão.`, response.status >= 500 || response.status === 408);
  const data = responseBody as {id?: unknown; post_id?: unknown} | null;
  const id = data?.post_id ?? data?.id;
  if (typeof id !== 'string' || !/^\d+(?:_\d+)?$/.test(id)) throw new FacebookPublishError('O Facebook não retornou um identificador de publicação válido.', true);
  return id;
}
