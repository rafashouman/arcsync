import 'server-only';

import { connectDB } from '@/src/libs/mongodb';
import { TikTokPostingQuota } from '@/src/models/TikTokPostingQuota';

const QUOTA_DOCUMENT_ID = 'content-posting';
const MAX_UNAUDITED_USERS_PER_DAY = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function reserveTikTokPostingUser(userId: string) {
  const db = await connectDB();
  if (!db) {
    throw new Error('MongoDB é obrigatório para validar o limite de publicação TikTok.');
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - WINDOW_MS);
  await TikTokPostingQuota.updateOne(
    { _id: QUOTA_DOCUMENT_ID },
    { $setOnInsert: { users: [] } },
    { upsert: true },
  );

  const activeUsers = {
    $filter: {
      input: { $ifNull: ['$users', []] },
      as: 'user',
      cond: { $gte: ['$$user.postedAt', cutoff] },
    },
  };
  const activeUserIds = {
    $map: { input: activeUsers, as: 'user', in: '$$user.userId' },
  };
  const reserved = await TikTokPostingQuota.findOneAndUpdate(
    {
      _id: QUOTA_DOCUMENT_ID,
      $expr: {
        $or: [
          { $in: [userId, activeUserIds] },
          { $lt: [{ $size: activeUsers }, MAX_UNAUDITED_USERS_PER_DAY] },
        ],
      },
    },
    [
      {
        $set: {
          users: {
            $let: {
              vars: { activeUsers },
              in: {
                $cond: [
                  {
                    $in: [
                      userId,
                      {
                        $map: {
                          input: '$$activeUsers',
                          as: 'user',
                          in: '$$user.userId',
                        },
                      },
                    ],
                  },
                  '$$activeUsers',
                  {
                    $concatArrays: [
                      '$$activeUsers',
                      [{ userId, postedAt: now }],
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    ],
    { new: true },
  );
  return Boolean(reserved);
}
