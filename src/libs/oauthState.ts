import { timingSafeEqual } from 'crypto';

export function isMatchingOAuthState(
  cookieValue: string | undefined,
  received: string | null,
  userId: string,
) {
  if (!cookieValue || !received) return false;
  const separator = cookieValue.lastIndexOf('.');
  if (separator <= 0) return false;
  const expected = cookieValue.slice(0, separator);
  const expectedUserId = cookieValue.slice(separator + 1);
  if (
    expectedUserId !== userId ||
    expected.length !== received.length
  ) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
