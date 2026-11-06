import assert from 'node:assert/strict';
import test from 'node:test';
import { checkEnvironmentReadiness } from '../src/libs/environmentReadiness.ts';

function validEnvironment(overrides = {}) {
  return {
    MONGODB_URI: 'mongodb://localhost:27017/arcsync',
    PUBLIC_APP_URL: 'http://localhost:3000',
    MEDIA_URL_SIGNING_KEY: `${'A'.repeat(43)}=`,
    SOCIAL_TOKEN_ENCRYPTION_KEY: `${'B'.repeat(43)}=`,
    CRON_SECRET: 'C'.repeat(40),
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_USER: 'mailer@example.com',
    SMTP_PASSWORD: 'do-not-print-this-password',
    SMTP_FROM: 'ArcSync <mailer@example.com>',
    NODE_ENV: 'development',
    ...overrides,
  };
}

test('accepts required local configuration and reports unverified social integrations', () => {
  const checks = checkEnvironmentReadiness(validEnvironment());

  assert.equal(checks.some((check) => check.level === 'error'), false);
  assert.deepEqual(
    checks.map(({ key, level }) => [key, level]),
    [
      ['Facebook', 'warning'],
      ['Instagram', 'warning'],
      ['TikTok', 'warning'],
      ['YouTube', 'warning'],
    ],
  );
  assert.equal(
    checks.some((check) => check.message.includes('do-not-print-this-password')),
    false,
  );
});

test('requires HTTPS and complete secrets for production', () => {
  const checks = checkEnvironmentReadiness(validEnvironment(), true);

  assert.ok(checks.some((check) => check.key === 'PUBLIC_APP_URL' && check.level === 'error'));
  assert.equal(
    checkEnvironmentReadiness(
      validEnvironment({
        PUBLIC_APP_URL: 'https://arcsync.example',
        NODE_ENV: 'production',
      }),
      true,
    ).some((check) => check.level === 'error'),
    false,
  );
});

test('flags malformed database, keys, SMTP, and partial OAuth configuration', () => {
  const checks = checkEnvironmentReadiness(
    validEnvironment({
      MONGODB_URI: 'https://db.example.com',
      MEDIA_URL_SIGNING_KEY: 'not-a-key',
      SMTP_PORT: '99999',
      INSTAGRAM_APP_ID: 'configured',
    }),
  );

  assert.ok(checks.some((check) => check.key === 'MONGODB_URI' && check.level === 'error'));
  assert.ok(checks.some((check) => check.key === 'MEDIA_URL_SIGNING_KEY' && check.level === 'error'));
  assert.ok(checks.some((check) => check.key === 'SMTP' && check.level === 'error'));
  assert.ok(checks.some((check) => check.key === 'Instagram' && check.level === 'warning'));
});

test('rejects invalid OAuth callback URLs and production HTTP callbacks', () => {
  const invalidPath = checkEnvironmentReadiness(
    validEnvironment({
      INSTAGRAM_APP_ID: 'id',
      INSTAGRAM_APP_SECRET: 'secret',
      INSTAGRAM_REDIRECT_URI: 'https://arcsync.example/wrong',
    }),
    true,
  );
  assert.ok(invalidPath.some((check) => check.key === 'Instagram' && check.level === 'error'));

  const localHttp = checkEnvironmentReadiness(
    validEnvironment({
      YOUTUBE_CLIENT_ID: 'id',
      YOUTUBE_CLIENT_SECRET: 'secret',
      YOUTUBE_REDIRECT_URI: 'http://localhost:3000/api/social/youtube/callback',
    }),
    true,
  );
  assert.ok(localHttp.some((check) => check.key === 'YouTube' && check.level === 'error'));
});

test('requires an absolute upload path in production and warns about local storage', () => {
  const checks = checkEnvironmentReadiness(
    validEnvironment({
      PUBLIC_APP_URL: 'https://arcsync.example',
      NODE_ENV: 'production',
      FEEDSYNC_UPLOADS_DIR: './relative-uploads',
    }),
    true,
  );
  assert.ok(
    checks.some((check) => check.key === 'FEEDSYNC_UPLOADS_DIR' && check.level === 'error'),
  );
  assert.ok(
    checks.some(
      (check) =>
        check.key === 'FEEDSYNC_UPLOADS_DIR' &&
        check.level === 'warning' &&
        check.message.includes('volume persistente'),
    ),
  );
});
