export class FacebookPublishError extends Error {
  constructor(message: string, public mayHaveSucceeded = false) { super(message); }
}

export async function publishFacebookPagePost(pageId: string, token: string, version: string, message: string, photoUrl?: string, fetcher: typeof fetch = fetch) {
  if (!/^\d+$/.test(pageId) || !/^v\d+\.0$/.test(version)) throw new FacebookPublishError('Destino do Facebook inválido.');
  let response: Response;
  try {
    response = await fetcher(`https://graph.facebook.com/${version}/${pageId}/${photoUrl ? 'photos' : 'feed'}`, {
      method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify(photoUrl ? {url:photoUrl,caption:message,published:true} : {message,published:true}),
      cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),
    });
  } catch { throw new FacebookPublishError('O Facebook não confirmou o resultado do envio.', true); }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new FacebookPublishError(`O Facebook recusou a publicação (HTTP ${response.status}). Confira permissões, mídia e conexão.`, response.status >= 500 || response.status === 408);
  const data = body as {id?: unknown; post_id?: unknown} | null;
  const id = data?.post_id ?? data?.id;
  if (typeof id !== 'string' || !/^\d+(?:_\d+)?$/.test(id)) throw new FacebookPublishError('O Facebook não retornou um identificador de publicação válido.', true);
  return id;
}
