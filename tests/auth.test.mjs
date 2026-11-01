import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPasswordIssue,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  verifyPassword,
} from '../src/libs/passwordAuth.ts';

test('normalizes and validates account email addresses', () => {
  assert.equal(normalizeEmail('  Rafa@Example.COM  '), 'rafa@example.com');
  assert.equal(isValidEmail('Rafa@Example.com'), true);
  assert.equal(isValidEmail('rafa@example'), false);
  assert.equal(isValidEmail('rafa example@example.com'), false);
});

test('requires a strong minimum password length and enforces the maximum', () => {
  assert.equal(getPasswordIssue('a'.repeat(11)), 'A senha precisa ter pelo menos 12 caracteres.');
  assert.equal(getPasswordIssue('a'.repeat(12)), null);
  assert.equal(getPasswordIssue('a'.repeat(129)), 'A senha não pode ter mais de 128 caracteres.');
});

test('stores passwords as scrypt hashes and verifies them safely', async () => {
  const password = 'correct horse battery staple';
  const passwordHash = await hashPassword(password);

  assert.match(passwordHash, /^scrypt\$32768\$8\$1\$/);
  assert.notEqual(passwordHash, password);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword('different password', passwordHash), false);
  assert.equal(await verifyPassword(password, null), false);
});
