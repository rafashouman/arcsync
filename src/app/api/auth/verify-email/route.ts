import { consumeAuthRateLimit, hashSessionToken, verifyEmailAddress } from '@/src/data/auth';
import {
  authJsonResponse,
  getClientIp,
  isSameOrigin,
  readAuthJson,
} from '@/src/libs/authRequest';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return authJsonResponse({ error: 'Origem da solicitação inválida.' }, 403);
  }

  const parsed = await readAuthJson(request);
  if ('error' in parsed) {
    return authJsonResponse(
      { error: 'Solicitação inválida.' },
      parsed.error === 'too-large' ? 413 : 400,
    );
  }
  if (
    !parsed.body ||
    typeof parsed.body !== 'object' ||
    !('token' in parsed.body) ||
    typeof parsed.body.token !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(parsed.body.token)
  ) {
    return authJsonResponse({ error: 'Link de verificação inválido.' }, 400);
  }

  try {
    const ipLimit = await consumeAuthRateLimit(
      'email-verification-confirm-ip',
      getClientIp(request),
      10,
      60 * 60 * 1000,
    );
    if (!ipLimit.allowed) {
      return authJsonResponse(
        { error: 'Muitas tentativas. Tente novamente mais tarde.' },
        429,
        { 'Retry-After': String(ipLimit.retryAfterSeconds) },
      );
    }

    const verified = await verifyEmailAddress(
      hashSessionToken(parsed.body.token),
    );
    if (!verified) {
      return authJsonResponse(
        { error: 'Este link é inválido, expirou ou já foi usado. Solicite outro link.' },
        400,
      );
    }
    return authJsonResponse({ success: true });
  } catch (error) {
    console.error('Erro ao confirmar o e-mail:', error);
    return authJsonResponse(
      { error: 'Não foi possível confirmar o e-mail agora. Tente novamente.' },
      503,
    );
  }
}
