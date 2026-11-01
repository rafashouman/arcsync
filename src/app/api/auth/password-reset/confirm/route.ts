import {
  consumeAuthRateLimit,
  consumePasswordResetToken,
  findPasswordResetTokenUser,
  hashSessionToken,
} from '@/src/data/auth';
import {
  authJsonResponse,
  getClientIp,
  isSameOrigin,
  readAuthJson,
} from '@/src/libs/authRequest';
import { getPasswordIssue, hashPassword } from '@/src/libs/passwordAuth';

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
    !/^[A-Za-z0-9_-]{43}$/.test(parsed.body.token) ||
    !('password' in parsed.body) ||
    typeof parsed.body.password !== 'string'
  ) {
    return authJsonResponse(
      { error: 'Link ou senha inválidos.' },
      400,
    );
  }

  const passwordIssue = getPasswordIssue(parsed.body.password);
  if (passwordIssue) {
    return authJsonResponse({ error: passwordIssue }, 400);
  }

  try {
    const ipLimit = await consumeAuthRateLimit(
      'password-reset-confirm-ip',
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

    const token = parsed.body.token;
    const tokenHash = hashSessionToken(token);
    if (!(await findPasswordResetTokenUser(tokenHash))) {
      return authJsonResponse(
        { error: 'Link inválido ou expirado. Solicite uma nova recuperação.' },
        400,
      );
    }

    const passwordHash = await hashPassword(parsed.body.password);
    const reset = await consumePasswordResetToken(tokenHash, passwordHash);
    if (!reset) {
      return authJsonResponse(
        { error: 'Link inválido ou expirado. Solicite uma nova recuperação.' },
        400,
      );
    }
    return authJsonResponse({ success: true });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return authJsonResponse(
      { error: 'Não foi possível redefinir a senha agora. Tente novamente.' },
      503,
    );
  }
}
