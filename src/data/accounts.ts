import 'server-only';

import { connectDB } from '@/src/libs/mongodb';
import { Account } from '@/src/models/Account';
import { encryptSocialToken } from '@/src/libs/socialTokenCrypto';

export interface InstagramAccountSummary {
  id: string;
  platformAccountId: string;
  accountName: string;
  tokenIssuedAt: string;
  expiresAt: string;
  permissions: string[];
  isDefault: boolean;
  connectedAt: string;
}

export interface InstagramAccountCredentials {
  platformAccountId: string;
  accountName: string;
  accessToken: string;
  tokenIssuedAt: Date;
  expiresAt: Date;
  permissions: string[];
}

export class AccountStorageUnavailableError extends Error {
  constructor() {
    super('Configure o MongoDB para salvar contas sociais com segurança.');
    this.name = 'AccountStorageUnavailableError';
  }
}

function serializeAccount(account: {
  _id: unknown;
  platformAccountId: string;
  accountName: string;
  tokenIssuedAt: Date | string;
  expiresAt: Date | string;
  permissions?: string[];
  isDefault?: boolean;
  createdAt: Date | string;
}): InstagramAccountSummary {
  return {
    id: String(account._id),
    platformAccountId: account.platformAccountId,
    accountName: account.accountName,
    tokenIssuedAt: new Date(account.tokenIssuedAt).toISOString(),
    expiresAt: new Date(account.expiresAt).toISOString(),
    permissions: account.permissions ?? [],
    isDefault: account.isDefault ?? false,
    connectedAt: new Date(account.createdAt).toISOString(),
  };
}

async function getAccountDatabase() {
  const db = await connectDB();
  if (!db) throw new AccountStorageUnavailableError();
  return db;
}

function workspaceAccountFilter(workspaceId: string) {
  return {
    $or: [
      { workspaceId },
      { workspaceId: { $exists: false }, userId: workspaceId },
    ],
  };
}

export async function listInstagramAccountsForWorkspace(
  workspaceId: string,
): Promise<InstagramAccountSummary[]> {
  await getAccountDatabase();
  const accounts = await Account.find({
    ...workspaceAccountFilter(workspaceId),
    platform: 'instagram',
    encryptedAccessToken: { $exists: true },
    expiresAt: { $type: 'date' },
  })
    .select(
      'platformAccountId accountName tokenIssuedAt expiresAt permissions isDefault createdAt',
    )
    .sort({ createdAt: -1 })
    .lean();
  return accounts.map(serializeAccount);
}

export async function saveInstagramAccount(
  workspaceId: string,
  connectedBy: string,
  credentials: InstagramAccountCredentials,
): Promise<void> {
  await getAccountDatabase();
  const encryptedAccessToken = encryptSocialToken(credentials.accessToken);
  const existing = await Account.findOne({
    workspaceId,
    platform: 'instagram',
    platformAccountId: credentials.platformAccountId,
  })
    .select('_id')
    .lean();
  const hasDefault = await Account.exists({
    workspaceId,
    platform: 'instagram',
    isDefault: true,
  });
  await Account.findOneAndUpdate(
    {
      workspaceId,
      platform: 'instagram',
      platformAccountId: credentials.platformAccountId,
    },
    {
      $set: {
        accountName: credentials.accountName,
        encryptedAccessToken,
        tokenIssuedAt: credentials.tokenIssuedAt,
        expiresAt: credentials.expiresAt,
        permissions: credentials.permissions,
        ...(!existing && !hasDefault ? { isDefault: true } : {}),
      },
      $setOnInsert: {
        userId: connectedBy,
        workspaceId,
        platform: 'instagram',
        platformAccountId: credentials.platformAccountId,
      },
    },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

export async function removeInstagramAccountForWorkspace(
  workspaceId: string,
  accountId: string,
): Promise<boolean> {
  await getAccountDatabase();
  if (!/^[a-f\d]{24}$/i.test(accountId)) return false;
  const result = await Account.deleteOne({
    _id: accountId,
    ...workspaceAccountFilter(workspaceId),
    platform: 'instagram',
  });
  if (result.deletedCount === 1) {
    const hasDefault = await Account.exists({
      ...workspaceAccountFilter(workspaceId),
      platform: 'instagram',
      isDefault: true,
    });
    if (!hasDefault) {
      const nextAccount = await Account.findOne({
        ...workspaceAccountFilter(workspaceId),
        platform: 'instagram',
      })
        .sort({ createdAt: 1 })
        .select('_id')
        .lean();
      if (nextAccount) {
        await Account.updateOne(
          { _id: nextAccount._id, ...workspaceAccountFilter(workspaceId) },
          { $set: { isDefault: true } },
        );
      }
    }
  }
  return result.deletedCount === 1;
}

export async function setDefaultInstagramAccountForWorkspace(
  workspaceId: string,
  accountId: string,
): Promise<boolean> {
  await getAccountDatabase();
  if (!/^[a-f\d]{24}$/i.test(accountId)) return false;

  const account = await Account.findOne({
    _id: accountId,
    ...workspaceAccountFilter(workspaceId),
    platform: 'instagram',
  })
    .select('_id')
    .lean();
  if (!account) return false;

  await Account.updateMany(
    { ...workspaceAccountFilter(workspaceId), platform: 'instagram', isDefault: true },
    { $set: { isDefault: false } },
  );
  const result = await Account.updateOne(
    { _id: account._id, ...workspaceAccountFilter(workspaceId) },
    { $set: { isDefault: true } },
  );
  return result.modifiedCount === 1;
}

export async function getDefaultInstagramAccountForWorkspace(workspaceId: string, accountId?: string) {
  await getAccountDatabase();
  const account = await Account.findOne({
    ...workspaceAccountFilter(workspaceId),
    platform: 'instagram',
    ...(accountId ? { _id: accountId } : { isDefault: true }),
    encryptedAccessToken: { $exists: true },
    expiresAt: { $type: 'date' },
  })
    .select('+encryptedAccessToken')
    .lean();
  if (!account) return null;

  return {
    id: String(account._id),
    platformAccountId: account.platformAccountId,
    accountName: account.accountName,
    encryptedAccessToken: account.encryptedAccessToken,
    tokenIssuedAt: account.tokenIssuedAt,
    expiresAt: account.expiresAt,
  };
}

export async function getInstagramAccountCredentialsForWorkspace(
  workspaceId: string,
  accountId: string,
) {
  await getAccountDatabase();
  if (!/^[a-f\d]{24}$/i.test(accountId)) return null;

  const account = await Account.findOne({
    _id: accountId,
    ...workspaceAccountFilter(workspaceId),
    platform: 'instagram',
  })
    .select('+encryptedAccessToken')
    .lean();

  if (!account) return null;
  return {
    id: String(account._id),
    platformAccountId: account.platformAccountId,
    accountName: account.accountName,
    encryptedAccessToken: account.encryptedAccessToken,
    tokenIssuedAt: account.tokenIssuedAt,
    expiresAt: account.expiresAt,
  };
}

export async function updateInstagramAccountToken(
  workspaceId: string,
  accountId: string,
  encryptedAccessToken: string,
  tokenIssuedAt: Date,
  expiresAt: Date,
) {
  await getAccountDatabase();
  if (!/^[a-f\d]{24}$/i.test(accountId)) return false;
  const result = await Account.updateOne(
    {
      _id: accountId,
      ...workspaceAccountFilter(workspaceId),
      platform: 'instagram',
    },
    { $set: { encryptedAccessToken, tokenIssuedAt, expiresAt } },
  );
  return result.modifiedCount === 1;
}
