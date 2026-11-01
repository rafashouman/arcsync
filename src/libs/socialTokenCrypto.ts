import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_VERSION = 'v1';

function getEncryptionKey() {
  const encodedKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!encodedKey) {
    throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY não está configurada.');
  }

  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'SOCIAL_TOKEN_ENCRYPTION_KEY deve ser uma chave base64 de 32 bytes.',
    );
  }
  return key;
}

export function encryptSocialToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptSocialToken(encryptedToken: string) {
  const [version, encodedIv, encodedAuthTag, encodedData, ...extra] =
    encryptedToken.split('.');
  if (
    version !== ENCRYPTION_VERSION ||
    !encodedIv ||
    !encodedAuthTag ||
    !encodedData ||
    extra.length > 0
  ) {
    throw new Error('Formato de token social criptografado inválido.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(encodedIv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(encodedAuthTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedData, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function assertSocialTokenEncryptionConfigured() {
  getEncryptionKey();
}

export function hasSocialTokenEncryptionKey() {
  const encodedKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  return Boolean(encodedKey && Buffer.from(encodedKey, 'base64').length === 32);
}
