import 'server-only';

import { createHash, createHmac } from 'crypto';
import { connection } from 'next/server';
import { connectDB } from '@/src/libs/mongodb';
import { AuthRateLimit } from '@/src/models/AuthRateLimit';
import { EmailVerificationToken } from '@/src/models/EmailVerificationToken';
import { PasswordResetToken } from '@/src/models/PasswordResetToken';
import { User } from '@/src/models/User';
import { UserSession } from '@/src/models/UserSession';

export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

async function requireDatabase() {
  const db = await connectDB();
  if (!db) {
    throw new Error('MongoDB precisa estar configurado para autenticação.');
  }
  return db;
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createUser(
  email: string,
  passwordHash: string,
  analyticsConsent = false,
) {
  await requireDatabase();
  return User.create({
    email,
    passwordHash,
    emailVerified: false,
    analyticsConsent,
    analyticsConsentUpdatedAt: new Date(),
  });
}

export async function findUserForLogin(email: string) {
  await requireDatabase();
  return User.findOne({ email }).select('+passwordHash').lean();
}

export async function findUnverifiedUser(email: string) {
  await requireDatabase();
  const user = await User.findOne({ email, emailVerified: false })
    .select('_id')
    .lean();
  return user ? { userId: String(user._id) } : null;
}

export async function createEmailVerificationToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) {
  await requireDatabase();
  await EmailVerificationToken.deleteMany({ userId });
  await EmailVerificationToken.create({ userId, tokenHash, expiresAt });
}

export async function deleteEmailVerificationToken(
  userId: string,
  tokenHash: string,
) {
  await requireDatabase();
  await EmailVerificationToken.deleteOne({ userId, tokenHash });
}

export async function deleteUnverifiedUser(userId: string) {
  await requireDatabase();
  const result = await User.deleteOne({ _id: userId, emailVerified: false });
  if (result.deletedCount === 1) {
    await EmailVerificationToken.deleteMany({ userId });
  }
  return result.deletedCount === 1;
}

export async function verifyEmailAddress(tokenHash: string, now = new Date()) {
  await requireDatabase();
  const token = await EmailVerificationToken.findOne({
    tokenHash,
    expiresAt: { $gt: now },
  })
    .select('userId')
    .lean();
  if (!token) return false;

  const result = await User.updateOne(
    { _id: token.userId, emailVerified: false },
    { $set: { emailVerified: true } },
  );
  if (result.matchedCount !== 1) {
    const alreadyVerified = await User.exists({
      _id: token.userId,
      emailVerified: true,
    });
    if (!alreadyVerified) {
      throw new Error('Usuário do token de verificação não foi encontrado.');
    }
  }
  await EmailVerificationToken.deleteMany({ userId: String(token.userId) });
  return true;
}

export async function findUserForPasswordReset(email: string) {
  await requireDatabase();
  return User.findOne({ email }).select('_id').lean();
}

export async function createPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) {
  await requireDatabase();
  await PasswordResetToken.deleteMany({ userId });
  await PasswordResetToken.create({ userId, tokenHash, expiresAt });
}

export async function findPasswordResetTokenUser(
  tokenHash: string,
  now = new Date(),
) {
  await requireDatabase();
  const resetToken = await PasswordResetToken.findOne({
    tokenHash,
    expiresAt: { $gt: now },
  })
    .select('userId')
    .lean();
  return resetToken ? String(resetToken.userId) : null;
}

export async function deletePasswordResetTokens(userId: string) {
  await requireDatabase();
  await PasswordResetToken.deleteMany({ userId });
}

export async function deletePasswordResetToken(
  userId: string,
  tokenHash: string,
) {
  await requireDatabase();
  await PasswordResetToken.deleteOne({ userId, tokenHash });
}

export async function consumePasswordResetToken(
  tokenHash: string,
  passwordHash: string,
  now = new Date(),
) {
  await requireDatabase();
  const resetToken = await PasswordResetToken.findOneAndDelete({
    tokenHash,
    expiresAt: { $gt: now },
  })
    .select('userId')
    .lean();
  if (!resetToken) return false;

  const userId = String(resetToken.userId);
  await UserSession.deleteMany({ userId });
  const update = await User.updateOne(
    { _id: userId },
    { $set: { passwordHash } },
  );
  if (update.matchedCount !== 1) {
    throw new Error('Usuário do token de recuperação não foi encontrado.');
  }
  await PasswordResetToken.deleteMany({ userId });
  return true;
}

export async function createUserSession(userId: string, token: string) {
  await requireDatabase();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await UserSession.create({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });
  return expiresAt;
}

export async function findUserForSession(token: string) {
  await connection(); // Garante que new Date() seja avaliado apenas em tempo de requisição

  const db = await connectDB();
  if (!db) return null;

  const session = await UserSession.findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: new Date() },
  })
    .select('+tokenHash')
    .lean();
  if (!session) return null;

  const user = await User.findById(session.userId)
    .select('email emailVerified analyticsConsent')
    .lean();
  if (!user) {
    await UserSession.deleteOne({ _id: session._id });
    return null;
  }
  if (user.emailVerified === false) {
    await UserSession.deleteOne({ _id: session._id });
    return null;
  }

  return {
    uid: String(user._id),
    email: user.email,
    analyticsConsent: Boolean(user.analyticsConsent),
  };
}

export async function getUserAnalyticsConsent(userId: string) {
  await requireDatabase();
  const user = await User.findById(userId)
    .select('analyticsConsent analyticsConsentUpdatedAt')
    .lean();
  if (!user) return null;
  return {
    analyticsConsent: Boolean(user.analyticsConsent),
    analyticsConsentUpdatedAt: user.analyticsConsentUpdatedAt
      ? new Date(user.analyticsConsentUpdatedAt)
      : null,
  };
}

export async function updateUserAnalyticsConsent(
  userId: string,
  analyticsConsent: boolean,
) {
  await requireDatabase();
  const updatedAt = new Date();
  const updated = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        analyticsConsent,
        analyticsConsentUpdatedAt: updatedAt,
      },
    },
    { new: true },
  )
    .select('analyticsConsent analyticsConsentUpdatedAt')
    .lean();
  if (!updated) {
    throw new Error('Usuário não encontrado.');
  }
  return {
    analyticsConsent: Boolean(updated.analyticsConsent),
    analyticsConsentUpdatedAt: updated.analyticsConsentUpdatedAt
      ? new Date(updated.analyticsConsentUpdatedAt)
      : updatedAt,
  };
}

export async function revokeUserSession(token: string) {
  await requireDatabase();
  await UserSession.deleteOne({ tokenHash: hashSessionToken(token) });
}

export async function consumeAuthRateLimit(
  scope: string,
  identifier: string,
  maximum: number,
  windowMs: number,
  now?: Date,
) {
  await requireDatabase();
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error(
      'MongoDB precisa estar configurado para limitar tentativas.',
    );
  }

  const currentTime = now ?? new Date();
  const window = Math.floor(currentTime.getTime() / windowMs);
  const key = createHmac('sha256', mongoUri)
    .update(`${scope}\0${identifier}\0${window}`)
    .digest('hex');
  const expiresAt = new Date((window + 2) * windowMs);

  let bucket;
  try {
    bucket = await AuthRateLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, new: true },
    ).lean();
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 11000
    ) {
      throw error;
    }

    bucket = await AuthRateLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 } },
      { new: true },
    ).lean();
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(((window + 1) * windowMs - currentTime.getTime()) / 1000),
  );
  return {
    allowed: Boolean(bucket && bucket.count <= maximum),
    retryAfterSeconds,
  };
}