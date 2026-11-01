import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPasswordResetUrl,
  getSmtpConfiguration,
} from '../src/libs/passwordResetConfig.ts';

const token = 'A'.repeat(43);

test('requires complete and valid SMTP settings', () => {
  assert.equal(getSmtpConfiguration({}), null);
  assert.deepEqual(
    getSmtpConfiguration({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'mailer@example.com',
      SMTP_PASSWORD: 'secret',
      SMTP_FROM: 'FeedSync <mailer@example.com>',
    }),
    {
      host: 'smtp.example.com',
      port: 587,
      user: 'mailer@example.com',
      password: 'secret',
      from: 'FeedSync <mailer@example.com>',
    },
  );
  assert.equal(
    getSmtpConfiguration({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '70000',
      SMTP_USER: 'mailer',
      SMTP_PASSWORD: 'secret',
      SMTP_FROM: 'mailer@example.com',
    }),
    null,
  );
  assert.equal(
    getSmtpConfiguration({
      SMTP_HOST: 'smtp.example.com:2525',
      SMTP_PORT: '587',
      SMTP_USER: 'mailer',
      SMTP_PASSWORD: 'secret',
      SMTP_FROM: 'mailer@example.com',
    }),
    null,
  );
  assert.equal(
    getSmtpConfiguration({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'mailer',
      SMTP_PASSWORD: 'secret',
      SMTP_FROM: 'mailer@example.com\r\nBcc: attacker@example.com',
    }),
    null,
  );
});

test('builds reset links only for secure public origins and local development', () => {
  assert.equal(
    getPasswordResetUrl(token, {
      PUBLIC_APP_URL: 'https://feedsync.example/app',
      NODE_ENV: 'production',
    }),
    `https://feedsync.example/reset-password?token=${token}`,
  );
  assert.equal(
    getPasswordResetUrl(token, {
      PUBLIC_APP_URL: 'http://localhost:3000',
      NODE_ENV: 'development',
    }),
    `http://localhost:3000/reset-password?token=${token}`,
  );
  assert.equal(
    getPasswordResetUrl(token, {
      PUBLIC_APP_URL: 'http://feedsync.example',
      NODE_ENV: 'production',
    }),
    null,
  );
  assert.equal(
    getPasswordResetUrl('invalid', {
      PUBLIC_APP_URL: 'https://feedsync.example',
      NODE_ENV: 'production',
    }),
    null,
  );
});
