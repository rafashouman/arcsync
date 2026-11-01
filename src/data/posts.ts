import 'server-only';

import { randomUUID } from 'crypto';
import { connectDB } from '@/src/libs/mongodb';
import { Post } from '@/src/models/Post';
import {
  hasPublishedPlatform,
  resetFailedPublishRecords,
  toPlatformStatuses,
  describePublishFailures,
  getPostPublishOutcome,
  type PlatformPublishRecord,
} from '@/src/libs/publishPlanning';
import type { PostRecord, SchedulePostInput } from '@/src/types/post';

interface StoredPost {
  ownerId: string;
  post: PostRecord;
}

const globalWithPosts = globalThis as typeof globalThis & {
  feedsyncMockPosts?: StoredPost[];
};
const mockPosts =
  globalWithPosts.feedsyncMockPosts ??
  (globalWithPosts.feedsyncMockPosts = []);

function serializePost(post: {
  _id: unknown;
  caption?: string;
  platforms?: PostRecord['platforms'];
  scheduledFor?: Date | string | null;
  timeZone?: string | null;
  mediaUrls?: string[];
  tiktokTitle?: string | null;
  tiktokPrivacyLevel?: PostRecord['tiktokPrivacyLevel'];
  tiktokAllowComments?: boolean;
  tiktokAllowDuet?: boolean;
  tiktokAllowStitch?: boolean;
  tiktokCommercialContent?: boolean;
  tiktokBrandOrganic?: boolean;
  tiktokBrandContent?: boolean;
  tiktokConsentAt?: Date | string | null;
  status?: PostRecord['status'];
  errorLog?: string;
  publishMayHaveSucceeded?: boolean;
  publishStates?: PlatformPublishRecord[];
  workspaceId?: string;
  userId?: string;
  mediaOwnerKeys?: string[];
  approvalStatus?: PostRecord['approvalStatus'];
  approvalHistory?: {
    action: 'requested' | 'approved' | 'rejected';
    userId: string;
    comment?: string;
    at: Date | string;
  }[];
}): PostRecord {
  const publishStates = post.publishStates ?? [];
  return {
    _id: String(post._id),
    ...(post.workspaceId ? { workspaceId: post.workspaceId } : {}),
    ...(post.userId ? { createdBy: post.userId } : {}),
    ...(post.mediaOwnerKeys
      ? { mediaOwnerKeys: post.mediaOwnerKeys }
      : {}),
    approvalStatus: post.approvalStatus ?? 'not_required',
    approvalHistory: (post.approvalHistory ?? []).map((entry) => ({
      action: entry.action,
      userId: entry.userId,
      ...(entry.comment ? { comment: entry.comment } : {}),
      at: new Date(entry.at).toISOString(),
    })),
    caption: post.caption ?? '',
    platforms: post.platforms ?? [],
    scheduledFor: post.scheduledFor
      ? new Date(post.scheduledFor).toISOString()
      : null,
    timeZone: post.timeZone ?? null,
    mediaUrls: post.mediaUrls ?? [],
    tiktokTitle: post.tiktokTitle ?? null,
    tiktokPrivacyLevel: post.tiktokPrivacyLevel ?? null,
    tiktokAllowComments: post.tiktokAllowComments ?? false,
    tiktokAllowDuet: post.tiktokAllowDuet ?? false,
    tiktokAllowStitch: post.tiktokAllowStitch ?? false,
    tiktokCommercialContent: post.tiktokCommercialContent ?? false,
    tiktokBrandOrganic: post.tiktokBrandOrganic ?? false,
    tiktokBrandContent: post.tiktokBrandContent ?? false,
    tiktokConsentAt: post.tiktokConsentAt
      ? new Date(post.tiktokConsentAt).toISOString()
      : null,
    status: post.status ?? 'pending',
    ...(post.errorLog ? { errorLog: post.errorLog } : {}),
    ...(post.publishMayHaveSucceeded ? { publishMayHaveSucceeded: true } : {}),
    ...(publishStates.length > 0
      ? { platformStatuses: toPlatformStatuses(publishStates) }
      : {}),
  };
}

export interface ClaimedPost extends PostRecord {
  userId: string;
  workspaceId: string;
  publisherState: 'idle' | 'container_ready' | 'publishing' | 'published';
  instagramContainerIds: string[];
  publishStates: PlatformPublishRecord[];
  processingRunId: string;
  attempts: number;
}

async function getPersistentDatabase() {
  const db = await connectDB();
  if (!db) {
    throw new Error('MongoDB é obrigatório para executar a fila de publicação.');
  }
  return db;
}

export async function listPostsForWorkspace(
  workspaceId: string,
): Promise<PostRecord[]> {
  const db = await connectDB();
  if (!db) {
    return mockPosts
      .filter((entry) => entry.ownerId === workspaceId)
      .map((entry) => entry.post)
      .sort(
        (a, b) =>
          (a.scheduledFor ? Date.parse(a.scheduledFor) : Number.POSITIVE_INFINITY) -
          (b.scheduledFor ? Date.parse(b.scheduledFor) : Number.POSITIVE_INFINITY),
      );
  }

  const posts = await Post.find({ workspaceId })
    .sort({ scheduledFor: 1 })
    .lean();
  return posts.map(serializePost);
}

export async function listPublishedYouTubeVideosForWorkspace(
  workspaceId: string,
) {
  const db = await connectDB();
  if (!db) return [];

  const posts = await Post.find({
    workspaceId,
    publishStates: {
      $elemMatch: { platform: 'youtube', state: 'published' },
    },
  })
    .select('caption publishStates updatedAt')
    .sort({ updatedAt: -1 })
    .limit(500)
    .lean();

  return posts.flatMap((post) =>
    (post.publishStates ?? []).flatMap((record: PlatformPublishRecord) =>
      record.platform === 'youtube' &&
      record.state === 'published' &&
      record.externalId
        ? [{ postId: String(post._id), caption: post.caption ?? '', videoId: record.externalId }]
        : [],
    ),
  );
}

export async function getPostForWorkspace(
  workspaceId: string,
  postId: string,
): Promise<PostRecord | null> {
  const db = await connectDB();
  if (!db) {
    return (
      mockPosts.find(
        (entry) => entry.ownerId === workspaceId && entry.post._id === postId,
      )?.post ?? null
    );
  }

  if (!/^[a-f\d]{24}$/i.test(postId)) return null;
  const post = await Post.findOne({ _id: postId, workspaceId }).lean();
  return post ? serializePost(post) : null;
}

function getMediaOwnerKeys(mediaUrls: string[]) {
  return [...new Set(
    mediaUrls.flatMap((url) => {
      const match = /^\/api\/media\/([a-f\d]{64})\/[a-f\d-]{36}\.(jpg|png|webp|gif|mp4|mov|webm)$/i.exec(url);
      return match ? [match[1]] : [];
    }),
  )];
}

export async function createPostForWorkspace(
  workspaceId: string,
  creatorId: string,
  input: SchedulePostInput,
  status: 'draft' | 'pending' = 'pending',
  approvalStatus: NonNullable<PostRecord['approvalStatus']> = 'not_required',
): Promise<PostRecord> {
  const db = await connectDB();
  if (!db) {
    const post: PostRecord = {
      _id: randomUUID(),
      workspaceId,
      createdBy: creatorId,
      mediaOwnerKeys: getMediaOwnerKeys(input.mediaUrls),
      ...input,
      status,
      approvalStatus,
      approvalHistory: approvalStatus === 'pending'
        ? [{ action: 'requested', userId: creatorId, at: new Date().toISOString() }]
        : [],
    };
    mockPosts.push({ ownerId: workspaceId, post });
    return post;
  }

  const post = await Post.create({
    ...input,
    userId: creatorId,
    workspaceId,
    mediaOwnerKeys: getMediaOwnerKeys(input.mediaUrls),
    approvalStatus,
    approvalHistory: approvalStatus === 'pending'
      ? [{ action: 'requested', userId: creatorId, at: new Date() }]
      : [],
    status,
  });
  return serializePost(post);
}

export async function updatePostForWorkspace(
  workspaceId: string,
  postId: string,
  actorId: string,
  input: SchedulePostInput,
  status: 'draft' | 'pending' = 'pending',
  approvalStatus: NonNullable<PostRecord['approvalStatus']> = 'not_required',
): Promise<PostRecord | null> {
  const db = await connectDB();
  if (!db) {
    const entry = mockPosts.find(
      (item) => item.ownerId === workspaceId && item.post._id === postId,
    );
    if (
      !entry ||
      entry.post.status === 'published' ||
      entry.post.status === 'processing' ||
      entry.post.publishMayHaveSucceeded ||
      hasPublishedPlatform(entry.post.platformStatuses ?? [])
    ) {
      return null;
    }
    entry.post = {
      ...entry.post,
      ...input,
      status,
      mediaOwnerKeys: getMediaOwnerKeys(input.mediaUrls),
      approvalStatus,
      approvalHistory: [
        ...(entry.post.approvalHistory ?? []),
        ...(approvalStatus === 'pending'
          ? [{ action: 'requested' as const, userId: actorId, at: new Date().toISOString() }]
          : []),
      ],
      errorLog: undefined,
      publishMayHaveSucceeded: false,
    };
    return entry.post;
  }

  if (!/^[a-f\d]{24}$/i.test(postId)) return null;
  const post = await Post.findOneAndUpdate(
    {
      _id: postId,
      workspaceId,
      status: { $in: ['draft', 'pending', 'failed'] },
      publishMayHaveSucceeded: { $ne: true },
      publishStates: { $not: { $elemMatch: { state: 'published' } } },
    },
    {
      $set: {
        ...input,
        mediaOwnerKeys: getMediaOwnerKeys(input.mediaUrls),
        approvalStatus,
        tiktokConsentAt: input.tiktokConsentAt
          ? new Date(input.tiktokConsentAt)
          : null,
        status,
        errorLog: '',
        publisherState: 'idle',
        instagramContainerIds: [],
        publishStates: [],
        processingRunId: '',
        processingStartedAt: null,
        nextAttemptAt: null,
        attempts: 0,
        publishedMediaId: '',
        publishMayHaveSucceeded: false,
      },
      ...(approvalStatus === 'pending'
        ? {
            $push: {
              approvalHistory: {
                action: 'requested',
                userId: actorId,
                at: new Date(),
              },
            },
          }
        : {}),
    },
    { new: true, runValidators: true },
  ).lean();
  return post ? serializePost(post) : null;
}

export async function retryFailedPostForWorkspace(
  workspaceId: string,
  postId: string,
  retryAt: Date,
): Promise<PostRecord | null> {
  const db = await connectDB();
  if (!db) {
    const entry = mockPosts.find(
      (item) => item.ownerId === workspaceId && item.post._id === postId,
    );
    if (
      !entry ||
      entry.post.status !== 'failed' ||
      entry.post.platforms.length === 0 ||
      entry.post.publishMayHaveSucceeded
    ) {
      return null;
    }

    entry.post = {
      ...entry.post,
      scheduledFor: retryAt.toISOString(),
      status: 'pending',
      errorLog: undefined,
      publishMayHaveSucceeded: false,
      platformStatuses: (entry.post.platformStatuses ?? []).filter(
        (record) => record.state !== 'failed',
      ),
    };
    return entry.post;
  }

  if (!/^[a-f\d]{24}$/i.test(postId)) return null;
  const retryFilter = {
    _id: postId,
    workspaceId,
    status: 'failed',
    publishMayHaveSucceeded: { $ne: true },
  };
  const current = await Post.findOne(retryFilter)
    .select('publishStates updatedAt')
    .lean();
  if (!current) return null;

  // Plataformas já publicadas são preservadas para que não sejam publicadas de novo.
  const post = await Post.findOneAndUpdate(
    { ...retryFilter, updatedAt: current.updatedAt },
    {
      $set: {
        scheduledFor: retryAt,
        status: 'pending',
        errorLog: '',
        publisherState: 'idle',
        instagramContainerIds: [],
        publishStates: resetFailedPublishRecords(current.publishStates ?? []),
        processingRunId: '',
        processingStartedAt: null,
        nextAttemptAt: null,
        attempts: 0,
        publishMayHaveSucceeded: false,
      },
    },
    { new: true, runValidators: true },
  ).lean();
  return post ? serializePost(post) : null;
}

export async function reschedulePendingPostForWorkspace(
  workspaceId: string,
  postId: string,
  scheduledFor: Date,
): Promise<PostRecord | null> {
  const db = await connectDB();
  if (!db) {
    const entry = mockPosts.find(
      (item) => item.ownerId === workspaceId && item.post._id === postId,
    );
    if (
      !entry ||
      entry.post.status !== 'pending' ||
      entry.post.publishMayHaveSucceeded
    ) {
      return null;
    }

    entry.post = { ...entry.post, scheduledFor: scheduledFor.toISOString() };
    return entry.post;
  }

  if (!/^[a-f\d]{24}$/i.test(postId)) return null;
  const post = await Post.findOneAndUpdate(
    {
      _id: postId,
      workspaceId,
      status: 'pending',
      publishMayHaveSucceeded: { $ne: true },
    },
    { $set: { scheduledFor } },
    { new: true, runValidators: true },
  ).lean();
  return post ? serializePost(post) : null;
}

export async function deletePostForWorkspace(
  workspaceId: string,
  postId: string,
): Promise<PostRecord | null> {
  const db = await connectDB();
  if (!db) {
    const index = mockPosts.findIndex(
      (item) => item.ownerId === workspaceId && item.post._id === postId,
    );
    if (index === -1) return null;

    const post = mockPosts[index].post;
    if (
      post.status === 'published' ||
      post.status === 'processing' ||
      post.publishMayHaveSucceeded
    ) return null;
    mockPosts.splice(index, 1);
    return post;
  }

  if (!/^[a-f\d]{24}$/i.test(postId)) return null;
  const post = await Post.findOneAndDelete({
    _id: postId,
    workspaceId,
    status: { $in: ['pending', 'failed'] },
    publishMayHaveSucceeded: { $ne: true },
  }).lean();
  return post ? serializePost(post) : null;
}

export async function listPendingApprovalPosts(workspaceId: string) {
  const db = await connectDB();
  if (!db) {
    return mockPosts
      .filter(
        (entry) =>
          entry.ownerId === workspaceId &&
          entry.post.approvalStatus === 'pending',
      )
      .map((entry) => entry.post);
  }
  const posts = await Post.find({
    workspaceId,
    status: 'pending',
    approvalStatus: 'pending',
  })
    .sort({ scheduledFor: 1 })
    .lean();
  return posts.map(serializePost);
}

export async function reviewPostForWorkspace(
  workspaceId: string,
  postId: string,
  reviewerId: string,
  decision: 'approve' | 'reject',
  comment: string,
) {
  const nextStatus = decision === 'approve' ? 'approved' : 'rejected';
  const action = decision === 'approve' ? 'approved' : 'rejected';
  const at = new Date();
  const db = await connectDB();
  if (!db) {
    const entry = mockPosts.find(
      (item) => item.ownerId === workspaceId && item.post._id === postId,
    );
    if (
      !entry ||
      entry.post.status !== 'pending' ||
      entry.post.approvalStatus !== 'pending'
    ) {
      return null;
    }
    entry.post = {
      ...entry.post,
      approvalStatus: nextStatus,
      approvalHistory: [
        ...(entry.post.approvalHistory ?? []),
        {
          action,
          userId: reviewerId,
          ...(comment ? { comment } : {}),
          at: at.toISOString(),
        },
      ],
      ...(decision === 'reject' && comment ? { errorLog: comment } : {}),
    };
    return entry.post;
  }

  if (!/^[a-f\d]{24}$/i.test(postId)) return null;
  const post = await Post.findOneAndUpdate(
    {
      _id: postId,
      workspaceId,
      status: 'pending',
      approvalStatus: 'pending',
    },
    {
      $set: {
        approvalStatus: nextStatus,
        errorLog: decision === 'reject' ? comment : '',
      },
      $push: {
        approvalHistory: {
          action,
          userId: reviewerId,
          ...(comment ? { comment } : {}),
          at,
        },
      },
    },
    { new: true, runValidators: true },
  ).lean();
  return post ? serializePost(post) : null;
}

export async function claimDuePost(
  now: Date,
  runId: string,
  leaseMs: number,
): Promise<ClaimedPost | null> {
  await getPersistentDatabase();
  const staleBefore = new Date(now.getTime() - leaseMs);
  const post = await Post.findOneAndUpdate(
    {
      scheduledFor: { $lte: now },
      $and: [
        {
          $or: [
            { status: 'pending' },
            {
              status: 'processing',
              $or: [
                { processingStartedAt: { $lte: staleBefore } },
                { processingStartedAt: { $exists: false } },
                { processingStartedAt: null },
              ],
            },
          ],
        },
        { approvalStatus: { $nin: ['pending', 'rejected'] } },
        {
          $or: [
            { nextAttemptAt: { $exists: false } },
            { nextAttemptAt: null },
            { nextAttemptAt: { $lte: now } },
          ],
        },
      ],
    },
    {
      $set: {
        status: 'processing',
        processingRunId: runId,
        processingStartedAt: now,
        errorLog: '',
      },
    },
    { new: true, sort: { scheduledFor: 1 } },
  ).lean();

  if (!post) return null;
  return {
    ...serializePost(post),
    userId: post.userId,
    workspaceId: String(post.workspaceId ?? post.userId),
    publisherState: post.publisherState ?? 'idle',
    instagramContainerIds: post.instagramContainerIds ?? [],
    publishStates: post.publishStates ?? [],
    processingRunId: runId,
    attempts: post.attempts ?? 0,
  };
}

export async function updateClaimedPost(
  postId: string,
  runId: string,
  fields: Record<string, unknown>,
) {
  await getPersistentDatabase();
  const result = await Post.updateOne(
    { _id: postId, status: 'processing', processingRunId: runId },
    { $set: fields },
  );
  return result.modifiedCount === 1;
}

export async function releaseClaimedPost(
  postId: string,
  runId: string,
  retryAt: Date,
  incrementAttempt = false,
) {
  await getPersistentDatabase();
  const result = await Post.updateOne(
    { _id: postId, status: 'processing', processingRunId: runId },
    {
      $set: {
        status: 'pending',
        nextAttemptAt: retryAt,
        processingRunId: '',
        processingStartedAt: null,
      },
      ...(incrementAttempt ? { $inc: { attempts: 1 } } : {}),
    },
  );
  return result.modifiedCount === 1;
}

export async function failClaimedPost(
  postId: string,
  runId: string,
  errorLog: string,
  publishMayHaveSucceeded = false,
) {
  await getPersistentDatabase();
  const result = await Post.updateOne(
    { _id: postId, status: 'processing', processingRunId: runId },
    {
      $set: {
        status: 'failed',
        errorLog,
        publishMayHaveSucceeded,
        processingRunId: '',
        processingStartedAt: null,
      },
    },
  );
  return result.modifiedCount === 1;
}

async function finishPlatformAttempt(
  postId: string,
  runId: string,
  platforms: PostRecord['platforms'],
  publishStates: PlatformPublishRecord[],
  publishMayHaveSucceeded = false,
  publishedMediaId?: string,
) {
  await getPersistentDatabase();
  const status = getPostPublishOutcome(platforms, publishStates);
  const now = new Date();
  const errorLog = describePublishFailures(publishStates);
  const result = await Post.updateOne(
    { _id: postId, status: 'processing', processingRunId: runId },
    {
      $set: {
        status,
        publisherState: 'idle',
        ...(publishedMediaId ? { publishedMediaId } : {}),
        publishStates,
        errorLog,
        publishMayHaveSucceeded,
        processingRunId: '',
        processingStartedAt: null,
        nextAttemptAt: status === 'pending' ? now : null,
      },
    },
  );
  return result.modifiedCount === 1;
}

export async function failClaimedPlatform(
  post: ClaimedPost,
  publishStates: PlatformPublishRecord[],
  publishMayHaveSucceeded = false,
) {
  return finishPlatformAttempt(
    post._id,
    post.processingRunId,
    post.platforms,
    publishStates,
    publishMayHaveSucceeded ||
      publishStates.some(
        (record) => record.state === 'failed' && record.mayHaveSucceeded,
      ),
  );
}

export async function completeClaimedPlatform(
  post: ClaimedPost,
  publishedMediaId: string,
  publishStates: PlatformPublishRecord[],
) {
  return finishPlatformAttempt(
    post._id,
    post.processingRunId,
    post.platforms,
    publishStates,
    publishStates.some(
      (record) => record.state === 'failed' && record.mayHaveSucceeded,
    ),
    publishedMediaId,
  );
}

export async function finalizeClaimedPost(post: ClaimedPost) {
  return finishPlatformAttempt(
    post._id,
    post.processingRunId,
    post.platforms,
    post.publishStates,
    post.publishStates.some(
      (record) => record.state === 'failed' && record.mayHaveSucceeded,
    ),
  );
}
