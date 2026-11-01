import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import path from 'path';

export const MEDIA_URL_MAX_AGE_SECONDS = 48 * 60 * 60;

export const MEDIA_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

const MEDIA_CONTENT_TYPES: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
};

export function getUploadsDirectory() {
  const configuredDirectory = process.env.FEEDSYNC_UPLOADS_DIR?.trim();
  return configuredDirectory
    ? path.resolve(configuredDirectory)
    : path.join(process.cwd(), 'uploads');
}

export function getMediaOwnerKey(uid: string) {
  return createHash('sha256').update(uid).digest('hex');
}

export function getMediaContentType(filename: string) {
  return MEDIA_CONTENT_TYPES[path.extname(filename).toLowerCase()];
}

export function getMediaFilePath(ownerKey: string, filename: string) {
  if (
    !/^[a-f\d]{64}$/i.test(ownerKey) ||
    !/^[a-f\d-]{36}\.(jpg|png|webp|gif|mp4|mov|webm)$/i.test(filename)
  ) {
    return null;
  }

  return path.join(getUploadsDirectory(), ownerKey, filename);
}

function getMediaSigningKey() {
  const encodedKey = process.env.MEDIA_URL_SIGNING_KEY;
  if (!encodedKey) {
    throw new Error('MEDIA_URL_SIGNING_KEY não está configurada.');
  }
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw new Error('MEDIA_URL_SIGNING_KEY deve ser uma chave base64 de 32 bytes.');
  }
  return key;
}

function signMediaUrl(ownerKey: string, filename: string, expiresAt: number) {
  return createHmac('sha256', getMediaSigningKey())
    .update(`${ownerKey}\n${filename}\n${expiresAt}`)
    .digest('base64url');
}

export function createSignedMediaUrl(
  origin: string,
  ownerKey: string,
  filename: string,
) {
  const baseUrl = new URL(origin);
  if (
    baseUrl.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(baseUrl.hostname)
  ) {
    throw new Error('PUBLIC_APP_URL deve usar HTTPS para compartilhar mídia com a Meta.');
  }
  baseUrl.pathname = '/api/media';
  baseUrl.search = '';
  baseUrl.hash = '';

  const url = new URL(
    `/api/media/${ownerKey}/${filename}`,
    baseUrl.origin,
  );
  const expiresAt = Math.floor(Date.now() / 1000) + MEDIA_URL_MAX_AGE_SECONDS;
  url.searchParams.set('expires', String(expiresAt));
  url.searchParams.set('signature', signMediaUrl(ownerKey, filename, expiresAt));
  return url.toString();
}

export function verifySignedMediaUrl(
  ownerKey: string,
  filename: string,
  expiresValue: string | null,
  signature: string | null,
) {
  if (
    !expiresValue ||
    !/^\d{1,12}$/.test(expiresValue) ||
    !signature ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  ) {
    return false;
  }

  const expiresAt = Number(expiresValue);
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + MEDIA_URL_MAX_AGE_SECONDS
  ) {
    return false;
  }

  const expected = Buffer.from(signMediaUrl(ownerKey, filename, expiresAt));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
