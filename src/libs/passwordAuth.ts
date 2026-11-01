import {
  randomBytes,
  scrypt as callbackScrypt,
  timingSafeEqual,
} from 'crypto';

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DUMMY_SALT = Buffer.alloc(SALT_LENGTH);

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    callbackScrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 254) return false;
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getPasswordIssue(value: unknown) {
  if (typeof value !== 'string') return 'Informe uma senha válida.';
  const length = [...value].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return `A senha não pode ter mais de ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  return null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);
  return `scrypt$32768$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null,
) {
  const parts = passwordHash?.split('$');
  if (
    !parts ||
    parts.length !== 6 ||
    parts[0] !== 'scrypt' ||
    parts[1] !== '32768' ||
    parts[2] !== '8' ||
    parts[3] !== '1'
  ) {
    await deriveKey(password, DUMMY_SALT);
    return false;
  }

  try {
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) {
      await deriveKey(password, DUMMY_SALT);
      return false;
    }

    const actual = await deriveKey(password, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    await deriveKey(password, DUMMY_SALT);
    return false;
  }
}
