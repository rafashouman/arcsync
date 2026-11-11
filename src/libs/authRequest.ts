export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0].trim() ??
    request.headers.get('host');
  if (!origin || !host) return false;

  try {
    const forwardedProtocol = request.headers
      .get('x-forwarded-proto')
      ?.split(',')[0]
      .trim();
    const protocol = forwardedProtocol ?? new URL(request.url).protocol.slice(0, -1);
    if (protocol !== 'http' && protocol !== 'https') return false;
    return new URL(origin).origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

export function getClientIp(request: Request) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp.slice(0, 100);
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim().slice(0, 100) ??
    'unknown'
  );
}

export async function readAuthJson(request: Request) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > 4096) {
    return { error: 'too-large' as const };
  }

  const reader = request.body?.getReader();
  if (!reader) return { error: 'invalid' as const };

  try {
    const chunks: Buffer[] = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > 4096) {
        await reader.cancel();
        return { error: 'too-large' as const };
      }
      chunks.push(Buffer.from(value));
    }
    return { body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown };
  } catch {
    return { error: 'invalid' as const };
  } finally {
    reader.releaseLock();
  }
}

export function authJsonResponse(
  body:
    | { error: string; code?: string }
    | { success: true; verificationRequired?: boolean },
  status = 200,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders);
  headers.set('Cache-Control', 'no-store');
  return Response.json(body, { status, headers });
}
