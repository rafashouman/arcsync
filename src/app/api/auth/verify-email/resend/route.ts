import { randomBytes } from 'crypto';
import {
  consumeAuthRateLimit,
  createEmailVerificationToken,
  deleteEmailVerificationToken,
  findUnverifiedUser,
  hashSessionToken,
  findUserForLogin,
} from '@/src/data/auth';
import {
  authJsonResponse,
  getClientIp,
  isSameOrigin,
  readAuthJson,
} from '@/src/libs/authRequest';
import {
  isEmailVerificationEmailConfigured,
  sendEmailVerification,
} from '@/src/libs/emailVerificationEmail';
import { isValidEmail, normalizeEmail, verifyPassword } from '@/src/libs/passwordAuth';

const EMAIL_VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1000;

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
    !isValidEmail(parsed.body.email) ||
    !('password' in parsed.body) ||
    typeof parsed.body.password !== 'string' ||
    [...parsed.body.password].length === 0 ||
    [...parsed.body.password].length > 128
  ) {
    return authJsonResponse({ error: 'E-mail ou senha inválidos.' }, 400);
  }

  if (!isEmailVerificationEmailConfigured()) {
    console.error(
      'Reenvio de verificação indisponível: SMTP e PUBLIC_APP_URL precisam estar configurados.',
    );
    return authJsonResponse(
      { error: 'O envio de e-mail está temporariamente indisponível.' },
      503,
    );
  }

  const email = normalizeEmail(parsed.body.email);
  try {
    const ipLimit = await consumeAuthRateLimit(
      'email-verification-resend-ip',
      getClientIp(request),
      5,
      60 * 60 * 1000,
    );
    if (!ipLimit.allowed) {
      return authJsonResponse(
        { error: 'Muitas solicitações. Tente novamente mais tarde.' },
        429,
        { 'Retry-After': String(ipLimit.retryAfterSeconds) },
      );
    }

    const emailLimit = await consumeAuthRateLimit(
      'email-verification-resend-email',
      email,
      3,
      60 * 60 * 1000,
    );
    if (!emailLimit.allowed) {
      return authJsonResponse(
        { error: 'Muitas solicitações. Tente novamente mais tarde.' },
        429,
        { 'Retry-After': String(emailLimit.retryAfterSeconds) },
      );
    }

    const user = await findUserForLogin(email);
    const passwordMatches = await verifyPassword(
      parsed.body.password,
      user?.passwordHash ?? null,
    );
    if (!user || !passwordMatches) {
      return authJsonResponse({ error: 'E-mail ou senha incorretos.' }, 401);
    }

    if (user.emailVerified !== false) {
      return authJsonResponse({ success: true });
    }

    const pendingUser = await findUnverifiedUser(email);
    if (!pendingUser) {
      return authJsonResponse({ success: true });
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashSessionToken(token);
    await createEmailVerificationToken(
      pendingUser.userId,
      tokenHash,
      new Date(Date.now() + EMAIL_VERIFICATION_DURATION_MS),
    );
    try {
      await sendEmailVerification(email, token);
    } catch (error) {
      console.error('Falha ao enviar o link de verificação:', error);
      try {
        await deleteEmailVerificationToken(pendingUser.userId, tokenHash);
      } catch (cleanupError) {
        console.error('Falha ao invalidar link de verificação não enviado:', cleanupError);
      }
      return authJsonResponse(
        { error: 'Não foi possível enviar o e-mail agora. Tente novamente.' },
        503,
      );
    }

    return authJsonResponse({ success: true });
  } catch (error) {
    console.error('Erro ao reenviar verificação de e-mail:', error);
    return authJsonResponse(
      { error: 'Não foi possível processar a solicitação. Tente novamente.' },
      503,
    );
  }
}
