function firstHeader(request: Request, name: string) {
  return request.headers.get(name)?.split(',')[0].trim() || undefined;
}

// Atrás de proxy reverso, request.url aponta para o host interno (ex.: localhost:3002).
export function publicUrl(path: string, request: Request) {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(path, new URL(configured).origin);
    } catch {
      // Cai para os cabeçalhos do proxy.
    }
  }

  const host = firstHeader(request, 'x-forwarded-host');
  if (host) {
    const proto = firstHeader(request, 'x-forwarded-proto') ?? 'https';
    try {
      return new URL(path, `${proto}://${host}`);
    } catch {
      // Cai para request.url.
    }
  }

  return new URL(path, request.url);
}
