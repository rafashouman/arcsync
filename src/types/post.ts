export const SOCIAL_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type TikTokPrivacyLevel =
  | 'PUBLIC_TO_EVERYONE'
  | 'FOLLOWER_OF_CREATOR'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'SELF_ONLY';
export type PostStatus =
  | 'draft'
  | 'pending'
  | 'processing'
  | 'published'
  | 'failed';
export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

export interface ApprovalHistoryEntry {
  action: 'requested' | 'approved' | 'rejected';
  userId: string;
  comment?: string;
  at: string;
}

export type PlatformPublishState =
  | 'uploading'
  | 'processing'
  | 'published'
  | 'failed';

export interface PlatformStatus {
  externalId?: string;
  platform: SocialPlatform;
  state: PlatformPublishState;
  error?: string;
  mayHaveSucceeded?: boolean;
}

export interface PostDestination {
  youtube?: YouTubeOptions;
  scheduledFor?: string;
  mediaUrls?: string[];
  platform: SocialPlatform;
  accountId: string;
  format: 'feed' | 'carousel' | 'reel' | 'story' | 'video';
  caption?: string;
}

export interface YouTubeOptions {
  title: string;
  description: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
  madeForKids: boolean;
  containsSyntheticMedia: boolean;
}

export interface PostHistoryEntry { at: string; event: string; runId?: string; states?: { platform: string; state: string }[]; }

export interface PostRecord {
  updatedAt?: string;
  deletedAt?: string;
  history?: PostHistoryEntry[];
  destinations?: PostDestination[];
  _id: string;
  workspaceId?: string;
  createdBy?: string;
  mediaOwnerKeys?: string[];
  approvalStatus?: ApprovalStatus;
  approvalHistory?: ApprovalHistoryEntry[];
  caption: string;
  platforms: SocialPlatform[];
  scheduledFor: string | null;
  timeZone: string | null;
  mediaUrls: string[];
  tiktokTitle?: string | null;
  tiktokPrivacyLevel?: TikTokPrivacyLevel | null;
  tiktokAllowComments?: boolean;
  tiktokAllowDuet?: boolean;
  tiktokAllowStitch?: boolean;
  tiktokCommercialContent?: boolean;
  tiktokBrandOrganic?: boolean;
  tiktokBrandContent?: boolean;
  tiktokConsentAt?: string | null;
  status: PostStatus;
  errorLog?: string;
  publishMayHaveSucceeded?: boolean;
  platformStatuses?: PlatformStatus[];
}

export interface SchedulePostInput {
  destinations?: PostDestination[];
  caption: string;
  platforms: SocialPlatform[];
  scheduledFor: string | null;
  timeZone: string;
  mediaUrls: string[];
  tiktokTitle?: string | null;
  tiktokPrivacyLevel?: TikTokPrivacyLevel | null;
  tiktokAllowComments?: boolean;
  tiktokAllowDuet?: boolean;
  tiktokAllowStitch?: boolean;
  tiktokCommercialContent?: boolean;
  tiktokBrandOrganic?: boolean;
  tiktokBrandContent?: boolean;
  tiktokConsentAt?: string | null;
}
