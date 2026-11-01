import { randomBytes } from 'crypto';
import {
  consumeAuthRateLimit,
  deletePasswordResetToken,
  createPasswordResetToken,
  findUserForPasswordReset,
  hashSessionToken,
} from '@/src/data/auth';
import {
  authJsonResponse,
  getClientIp,
  isSameOrigin,
  readAuthJson,
} from '@/src/libs/authRequest';
import {
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from '@/src/libs/passwordResetEmail';
import { isValidEmail, normalizeEmail } from '@/src/libs/passwordAuth';

const genericResponse = () =>
  authJsonResponse({
    success: true,
  });

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
    !isValidEmail(parsed.body.email)
  ) {
    return authJsonResponse({ error: 'Informe um e-mail válido.' }, 400);
  }

  if (!isPasswordResetEmailConfigured()) {
    console.error(
      'Recuperação de senha indisponível: SMTP e PUBLIC_APP_URL precisam estar configurados.',
    );
    return authJsonResponse(
      { error: 'A recuperação de senha está temporariamente indisponível.' },
      503,
    );
  }

  const email = normalizeEmail(parsed.body.email);
  try {
    const ipLimit = await consumeAuthRateLimit(
      'password-reset-ip',
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
      'password-reset-email',
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

    const user = await findUserForPasswordReset(email);
    if (user) {
      const userId = String(user._id);
      const token = randomBytes(32).toString('base64url');
      const tokenHash = hashSessionToken(token);
      try {
        await createPasswordResetToken(
          userId,
          tokenHash,
          new Date(Date.now() + 60 * 60 * 1000),
        );
        await sendPasswordResetEmail(email, token);
      } catch (error) {
        console.error('Falha ao preparar ou enviar e-mail de recuperação:', error);
        try {
          await deletePasswordResetToken(userId, tokenHash);
        } catch (cleanupError) {
          console.error('Falha ao invalidar link de recuperação não enviado:', cleanupError);
        }
      }
    }

    return genericResponse();
  } catch (error) {
    console.error('Erro ao solicitar recuperação de senha:', error);
    return authJsonResponse(
      { error: 'Não foi possível processar a solicitação. Tente novamente.' },
      503,
    );
  }
}
