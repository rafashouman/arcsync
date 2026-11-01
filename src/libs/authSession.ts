import 'server-only';

import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import {
  createUserSession,
  findUserForSession,
  revokeUserSession,
  SESSION_DURATION_MS,
} from '@/src/data/auth';


export const SESSION_COOKIE_NAME = 'feedsync_session';
export { SESSION_DURATION_MS };

export interface AuthenticatedUser {
  uid: string;
  email: string;
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  await connection();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return findUserForSession(token);
}

export async function createAuthenticatedSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = await createUserSession(userId, token);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export async function clearAuthenticatedSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await revokeUserSession(token);
  }
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
