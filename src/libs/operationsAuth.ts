import { timingSafeEqual } from 'node:crypto';

export function isOperationsAuthorized(request: Request, secret = process.env.CRON_SECRET) {
  if (!secret || secret.length < 32) return false;
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) return false;
  const supplied = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
