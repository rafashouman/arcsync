import { createAuthenticatedSession, clearAuthenticatedSession } from '@/src/libs/authSession';
import { authJsonResponse, getClientIp, isSameOrigin, readAuthJson } from '@/src/libs/authRequest';
import { consumeAuthRateLimit, findUserForLogin } from '@/src/data/auth';
import { isValidEmail, normalizeEmail, verifyPassword } from '@/src/libs/passwordAuth';

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
    !('email' in parsed.body) ||
    !('password' in parsed.body) ||
    !isValidEmail(parsed.body.email) ||
    typeof parsed.body.password !== 'string' ||
    [...parsed.body.password].length === 0 ||
    [...parsed.body.password].length > 128
  ) {
    return authJsonResponse({ error: 'E-mail ou senha inválidos.' }, 400);
  }

  const email = normalizeEmail(parsed.body.email);
  const password = parsed.body.password;
  try {
    const ipLimit = await consumeAuthRateLimit(
      'login-ip',
      getClientIp(request),
      30,
      15 * 60 * 1000,
    );
    if (!ipLimit.allowed) {
      return authJsonResponse(
        { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
        429,
        { 'Retry-After': String(ipLimit.retryAfterSeconds) },
      );
    }

    const emailLimit = await consumeAuthRateLimit(
      'login-email',
      email,
      10,
      15 * 60 * 1000,
    );
    if (!emailLimit.allowed) {
      return authJsonResponse(
        { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
        429,
        { 'Retry-After': String(emailLimit.retryAfterSeconds) },
      );
    }

    const user = await findUserForLogin(email);
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? null,
    );
    if (!user || !passwordMatches) {
      return authJsonResponse(
        { error: 'E-mail ou senha incorretos.' },
        401,
      );
    }

    await createAuthenticatedSession(String(user._id));
    return authJsonResponse({ success: true });
  } catch (error) {
    console.error('Erro ao autenticar usuário:', error);
    return authJsonResponse(
      { error: 'Serviço de autenticação indisponível. Tente novamente.' },
      503,
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return authJsonResponse({ error: 'Origem da solicitação inválida.' }, 403);
  }

  try {
    await clearAuthenticatedSession();
    return authJsonResponse({ success: true });
  } catch (error) {
    console.error('Erro ao encerrar sessão do usuário:', error);
    return authJsonResponse(
      { error: 'Não foi possível encerrar a sessão. Tente novamente.' },
      503,
    );
  }
}
