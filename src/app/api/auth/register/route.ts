import { createUser, consumeAuthRateLimit } from '@/src/data/auth';
import { authJsonResponse, getClientIp, isSameOrigin, readAuthJson } from '@/src/libs/authRequest';
import { createAuthenticatedSession } from '@/src/libs/authSession';
import {
  getPasswordIssue,
  hashPassword,
  isValidEmail,
  normalizeEmail,
} from '@/src/libs/passwordAuth';

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

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
    typeof parsed.body.password !== 'string'
  ) {
    return authJsonResponse({ error: 'Informe um e-mail válido.' }, 400);
  }

  const passwordIssue = getPasswordIssue(parsed.body.password);
  if (passwordIssue) {
    return authJsonResponse({ error: passwordIssue }, 400);
  }

  const email = normalizeEmail(parsed.body.email);
  const password = parsed.body.password;
  try {
    const ipLimit = await consumeAuthRateLimit(
      'register-ip',
      getClientIp(request),
      5,
      60 * 60 * 1000,
    );
    if (!ipLimit.allowed) {
      return authJsonResponse(
        { error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' },
        429,
        { 'Retry-After': String(ipLimit.retryAfterSeconds) },
      );
    }

    const emailLimit = await consumeAuthRateLimit(
      'register-email',
      email,
      3,
      60 * 60 * 1000,
    );
    if (!emailLimit.allowed) {
      return authJsonResponse(
        { error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' },
        429,
        { 'Retry-After': String(emailLimit.retryAfterSeconds) },
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash);
    await createAuthenticatedSession(String(user._id));
    return authJsonResponse({ success: true }, 201);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return authJsonResponse(
        { error: 'Este e-mail já possui uma conta.' },
        409,
      );
    }
    console.error('Erro ao criar usuário:', error);
    return authJsonResponse(
      { error: 'Não foi possível criar a conta agora. Tente novamente.' },
      503,
    );
  }
}
