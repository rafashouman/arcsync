import './server-only-register.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/test-unused';
process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');

const { Account } = await import('../src/models/Account.ts');
const { encryptSocialToken } = await import('../src/libs/socialTokenCrypto.ts');
const { getValidSocialAccessToken } = await import('../src/libs/socialTokens.ts');

test('Facebook uses saved page tokens even when the legacy expiry has passed', async (t) => {
  t.mock.method(mongoose, 'connect', async () => mongoose);
  const encryptedAccessToken = encryptSocialToken('page-token');
  let expiresAt = new Date(0);
  t.mock.method(Account, 'findOne', () => ({
    select: () => ({
      lean: async () => ({
        _id: 'account-id',
        platformAccountId: '123',
        encryptedAccessToken,
        expiresAt,
      }),
    }),
  }));
  assert.equal(await getValidSocialAccessToken('workspace', 'facebook'), 'page-token');
  expiresAt = null;
  assert.equal(await getValidSocialAccessToken('workspace', 'facebook'), 'page-token');
  await assert.rejects(
    getValidSocialAccessToken('workspace', 'youtube'),
    /validade da autorização do YouTube é desconhecida/,
  );
  expiresAt = new Date(0);
  await assert.rejects(
    getValidSocialAccessToken('workspace', 'youtube'),
    /autorização do YouTube expirou/,
  );
  expiresAt = new Date(Date.now() + 3600_000);
  assert.equal(await getValidSocialAccessToken('workspace', 'youtube'), 'page-token');
});

test('account expiry is optional only for Facebook, including updates', async (t) => {
  const base = {
    userId: 'user',
    platformAccountId: '123',
    accountName: 'Page',
    encryptedAccessToken: 'encrypted',
    tokenIssuedAt: new Date(),
    expiresAt: null,
  };
  await new Account({ ...base, platform: 'facebook' }).validate();
  await assert.rejects(new Account({ ...base, platform: 'youtube' }).validate(), /expiresAt/);

  t.mock.method(Account.collection, 'findOneAndUpdate', async () => null);
  await Account.findOneAndUpdate(
    { platform: 'facebook' },
    { $set: { expiresAt: null } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await assert.rejects(
    Account.findOneAndUpdate(
      { platform: 'youtube' },
      { $set: { expiresAt: null } },
      { runValidators: true },
    ),
    /expiresAt/,
  );
});
