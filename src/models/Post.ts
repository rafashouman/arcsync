import mongoose, { Schema, Document, models } from 'mongoose';
import type { PlatformPublishRecord } from '@/src/libs/publishPlanning';
import type { TikTokPrivacyLevel } from '@/src/types/post';

export interface IPost extends Document {
  userId: string;
  workspaceId?: string;
  mediaOwnerKeys: string[];
  approvalStatus: 'not_required' | 'pending' | 'approved' | 'rejected';
  approvalHistory: {
    action: 'requested' | 'approved' | 'rejected';
    userId: string;
    comment?: string;
    at: Date;
  }[];
  caption?: string;
  mediaUrls: string[];
  tiktokTitle?: string | null;
  tiktokPrivacyLevel?: TikTokPrivacyLevel | null;
  tiktokAllowComments?: boolean;
  tiktokAllowDuet?: boolean;
  tiktokAllowStitch?: boolean;
  tiktokCommercialContent?: boolean;
  tiktokBrandOrganic?: boolean;
  tiktokBrandContent?: boolean;
  tiktokConsentAt?: Date | null;
  platforms: ('instagram' | 'tiktok' | 'youtube')[];
  scheduledFor?: Date;
  timeZone?: string;
  status: 'draft' | 'pending' | 'processing' | 'published' | 'failed';
  errorLog?: string;
  publisherState: 'idle' | 'container_ready' | 'publishing' | 'published';
  instagramContainerIds: string[];
  publishStates: PlatformPublishRecord[];
  processingRunId?: string;
  processingStartedAt?: Date;
  nextAttemptAt?: Date;
  attempts: number;
  publishedMediaId?: string;
  publishMayHaveSucceeded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PublishStateSchema = new Schema(
  {
    platform: {
      type: String,
      enum: ['instagram', 'tiktok', 'youtube'],
      required: true,
    },
    state: {
      type: String,
      enum: ['uploading', 'processing', 'published', 'failed'],
      required: true,
    },
    externalId: { type: String },
    uploadUrl: { type: String },
    uploadedBytes: { type: Number },
    startedAt: { type: String },
    error: { type: String },
    mayHaveSucceeded: { type: Boolean },
  },
  { _id: false },
);

const ApprovalHistorySchema = new Schema(
  {
    action: {
      type: String,
      enum: ['requested', 'approved', 'rejected'],
      required: true,
    },
    userId: { type: String, required: true },
    comment: { type: String, maxlength: 1000 },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const PostSchema = new Schema<IPost>({
  userId: { type: String, required: true, index: true },
  workspaceId: { type: String, index: true },
  mediaOwnerKeys: { type: [String], default: [] },
  approvalStatus: {
    type: String,
    enum: ['not_required', 'pending', 'approved', 'rejected'],
    default: 'not_required',
    index: true,
  },
  approvalHistory: { type: [ApprovalHistorySchema], default: [] },
  caption: { type: String, default: '' },
  mediaUrls: { type: [String], default: [] },
  tiktokTitle: { type: String, default: null },
  tiktokPrivacyLevel: {
    type: String,
    enum: ['PUBLIC_TO_EVERYONE', 'FOLLOWER_OF_CREATOR', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY', null],
    default: null,
  },
  tiktokAllowComments: { type: Boolean, default: false },
  tiktokAllowDuet: { type: Boolean, default: false },
  tiktokAllowStitch: { type: Boolean, default: false },
  tiktokCommercialContent: { type: Boolean, default: false },
  tiktokBrandOrganic: { type: Boolean, default: false },
  tiktokBrandContent: { type: Boolean, default: false },
  tiktokConsentAt: { type: Date, default: null },
  platforms: [{ 
    type: String, 
    enum: ['instagram', 'tiktok', 'youtube'],
    required: true 
  }],
  scheduledFor: { type: Date },
  timeZone: { type: String },
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'processing', 'published', 'failed'], 
    default: 'pending' 
  },
  errorLog: { type: String },
  publisherState: {
    type: String,
    enum: ['idle', 'container_ready', 'publishing', 'published'],
    default: 'idle',
  },
  instagramContainerIds: { type: [String], default: [] },
  publishStates: { type: [PublishStateSchema], default: [] },
  processingRunId: { type: String },
  processingStartedAt: { type: Date },
  nextAttemptAt: { type: Date },
  attempts: { type: Number, default: 0 },
  publishedMediaId: { type: String },
  publishMayHaveSucceeded: { type: Boolean, default: false },
}, { 
  timestamps: true 
});

PostSchema.index({ userId: 1, scheduledFor: 1 });
PostSchema.index({ workspaceId: 1, scheduledFor: 1 });
PostSchema.index({ status: 1, scheduledFor: 1, nextAttemptAt: 1 });

export const Post = models.Post || mongoose.model<IPost>('Post', PostSchema);