import 'server-only';

import { connectDB } from '@/src/libs/mongodb';
import { AccountStorageUnavailableError } from '@/src/data/accounts';
import { Account } from '@/src/models/Account';
import { decryptSocialToken, encryptSocialToken } from '@/src/libs/socialTokenCrypto';
import type {
  ConnectedSocialAccount,
  OAuthTokenSet,
} from '@/src/libs/socialOAuth';

export type OAuthPlatform = 'tiktok' | 'youtube' | 'facebook';

export function isOAuthPlatform(value: unknown): value is OAuthPlatform {
  return value === 'tiktok' || value === 'youtube' || value === 'facebook';
}

export interface SocialAccountSummary {
  id: string;
  platformAccountId: string;
  accountName: string;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  isDefault: boolean;
  connectedAt: string;
}

async function requireDatabase() {
  const db = await connectDB();
  if (!db) throw new AccountStorageUnavailableError();
}

function isObjectId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}

function workspaceAccountFilter(workspaceId: string) {
  return {
    $or: [
      { workspaceId },
      { workspaceId: { $exists: false }, userId: workspaceId },
    ],
  };
}

export async function listSocialAccountsForWorkspace(
  workspaceId: string,
  platform: OAuthPlatform,
): Promise<SocialAccountSummary[]> {
  await requireDatabase();
  const accounts = await Account.find({
    ...workspaceAccountFilter(workspaceId),
    platform,
  })
    .select(
      'platformAccountId accountName expiresAt refreshExpiresAt isDefault createdAt',
    )
    .sort({ createdAt: -1 })
    .lean();
  return accounts.map((account) => ({
    id: String(account._id),
    platformAccountId: account.platformAccountId,
    accountName: account.accountName,
    accessTokenExpiresAt: platform === 'facebook' || !account.expiresAt
      ? null
      : new Date(account.expiresAt).toISOString(),
    refreshTokenExpiresAt: account.refreshExpiresAt
      ? new Date(account.refreshExpiresAt).toISOString()
      : null,
    isDefault: account.isDefault ?? false,
    connectedAt: new Date(account.createdAt).toISOString(),
  }));
}

export async function saveSocialAccount(
  workspaceId: string,
  connectedBy: string,
  platform: OAuthPlatform,
  account: ConnectedSocialAccount,
) {
  await requireDatabase();
  const existing = await Account.exists({
    workspaceId,
    platform,
    platformAccountId: account.platformAccountId,
  });
  const hasDefault = await Account.exists({
    workspaceId,
    platform,
    isDefault: true,
  });

  await Account.findOneAndUpdate(
    { workspaceId, platform, platformAccountId: account.platformAccountId },
    {
      $set: {
        accountName: account.accountName,
        encryptedAccessToken: encryptSocialToken(account.accessToken),
        encryptedRefreshToken: account.refreshToken ? encryptSocialToken(account.refreshToken) : undefined,
        tokenIssuedAt: new Date(),
        expiresAt: account.accessTokenExpiresAt,
        refreshExpiresAt: account.refreshTokenExpiresAt,
        permissions: account.permissions,
        ...(!existing && !hasDefault ? { isDefault: true } : {}),
      },
      $setOnInsert: {
        userId: connectedBy,
        workspaceId,
        platform,
        platformAccountId: account.platformAccountId,
      },
    },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

export async function getSocialAccountSecretsForWorkspace(
  workspaceId: string,
  platform: OAuthPlatform,
  accountId: string,
) {
  await requireDatabase();
  if (!isObjectId(accountId)) return null;
  const account = await Account.findOne({
    _id: accountId,
    ...workspaceAccountFilter(workspaceId),
    platform,
  })
    .select('+encryptedAccessToken +encryptedRefreshToken')
    .lean();
  if (!account) return null;
  return {
    accessToken: safeDecrypt(account.encryptedAccessToken),
    refreshToken: safeDecrypt(account.encryptedRefreshToken),
  };
}

function safeDecrypt(value: string | undefined) {
  if (!value) return null;
  try {
    return decryptSocialToken(value);
  } catch {
    return null;
  }
}

export async function removeSocialAccountForWorkspace(
  workspaceId: string,
  platform: OAuthPlatform,
  accountId: string,
) {
  await requireDatabase();
  if (!isObjectId(accountId)) return false;
  const result = await Account.deleteOne({
    _id: accountId,
    ...workspaceAccountFilter(workspaceId),
    platform,
  });
  if (result.deletedCount !== 1) return false;

  const hasDefault = await Account.exists({
    ...workspaceAccountFilter(workspaceId),
    platform,
    isDefault: true,
  });
  if (!hasDefault) {
    const next = await Account.findOne({
      ...workspaceAccountFilter(workspaceId),
      platform,
    })
      .sort({ createdAt: 1 })
      .select('_id')
      .lean();
    if (next) {
      await Account.updateOne(
        { _id: next._id, ...workspaceAccountFilter(workspaceId) },
        { $set: { isDefault: true } },
      );
    }
  }
  return true;
}

export async function setDefaultSocialAccountForWorkspace(
  workspaceId: string,
  platform: OAuthPlatform,
  accountId: string,
) {
  await requireDatabase();
  if (!isObjectId(accountId)) return false;
  const account = await Account.findOne({
    _id: accountId,
    ...workspaceAccountFilter(workspaceId),
    platform,
  })
    .select('_id')
    .lean();
  if (!account) return false;

  await Account.updateMany(
    { ...workspaceAccountFilter(workspaceId), platform, isDefault: true },
    { $set: { isDefault: false } },
  );
  const result = await Account.updateOne(
    { _id: account._id, ...workspaceAccountFilter(workspaceId) },
    { $set: { isDefault: true } },
  );
  return result.modifiedCount === 1;
}

export async function getDefaultSocialAccountForWorkspace(
  workspaceId: string,
  platform: OAuthPlatform,
  accountId?: string,
) {
  await requireDatabase();
  const account = await Account.findOne({
    ...workspaceAccountFilter(workspaceId),
    platform,
    ...(accountId ? { _id: accountId } : { isDefault: true }),
  })
    .select('+encryptedAccessToken +encryptedRefreshToken')
    .lean();
  if (!account) return null;
  return {
    id: String(account._id),
    accountName: account.accountName as string,
    platformAccountId: account.platformAccountId,
    permissions: (account.permissions as string[] | undefined) ?? [],
    encryptedAccessToken: account.encryptedAccessToken as string,
    encryptedRefreshToken: (account.encryptedRefreshToken as string | undefined) ?? null,
    accessTokenExpiresAt: account.expiresAt ? new Date(account.expiresAt) : null,
    refreshTokenExpiresAt: account.refreshExpiresAt
      ? new Date(account.refreshExpiresAt)
      : null,
  };
}

export async function updateSocialAccountTokens(
  workspaceId: string,
  platform: OAuthPlatform,
  accountId: string,
  tokens: OAuthTokenSet,
) {
  await requireDatabase();
  if (!isObjectId(accountId)) return false;
  const result = await Account.updateOne(
    {
      _id: accountId,
      ...workspaceAccountFilter(workspaceId),
      platform,
    },
    {
      $set: {
        encryptedAccessToken: encryptSocialToken(tokens.accessToken),
        encryptedRefreshToken: encryptSocialToken(tokens.refreshToken),
        tokenIssuedAt: new Date(),
        expiresAt: tokens.accessTokenExpiresAt,
        refreshExpiresAt: tokens.refreshTokenExpiresAt,
      },
    },
  );
  return result.matchedCount === 1;
}
