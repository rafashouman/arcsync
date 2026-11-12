import {
  consumeAuthRateLimit,
  createEmailVerificationToken,
  createUser,
  deleteUnverifiedUser,
  hashSessionToken,
} from '@/src/data/auth';
import { authJsonResponse, getClientIp, isSameOrigin, readAuthJson } from '@/src/libs/authRequest';
import {
  isEmailVerificationEmailConfigured,
  sendEmailVerification,
} from '@/src/libs/emailVerificationEmail';
import {
  getPasswordIssue,
  hashPassword,
  isValidEmail,
  normalizeEmail,
} from '@/src/libs/passwordAuth';
import { randomBytes } from 'crypto';

const EMAIL_VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1000;

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
  const analyticsConsent =
    'analyticsConsent' in parsed.body && parsed.body.analyticsConsent === true;
  if (!isEmailVerificationEmailConfigured()) {
    console.error(
      'Cadastro indisponível: SMTP e PUBLIC_APP_URL precisam estar configurados para verificar e-mails.',
    );
    return authJsonResponse(
      { error: 'O cadastro está temporariamente indisponível. Tente novamente mais tarde.' },
      503,
    );
  }

  let userId: string | null = null;
  let tokenHash: string | null = null;
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
    const user = await createUser(email, passwordHash, analyticsConsent);
    userId = String(user._id);
    const token = randomBytes(32).toString('base64url');
    tokenHash = hashSessionToken(token);
    await createEmailVerificationToken(
      userId,
      tokenHash,
      new Date(Date.now() + EMAIL_VERIFICATION_DURATION_MS),
    );
    await sendEmailVerification(email, token);
    return authJsonResponse({ success: true, verificationRequired: true }, 201);
  } catch (error) {
    if (isDuplicateKeyError(error) && !userId) {
      return authJsonResponse(
        { error: 'Este e-mail já possui uma conta.' },
        409,
      );
    }
    console.error('Erro ao criar usuário:', error);
    if (userId) {
      try {
        await deleteUnverifiedUser(userId);
      } catch (cleanupError) {
        console.error('Erro ao limpar cadastro não confirmado:', cleanupError);
      }
    }
    return authJsonResponse(
      { error: 'Não foi possível criar a conta agora. Tente novamente.' },
      503,
    );
  }
}
