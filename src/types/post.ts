export const SOCIAL_PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const;

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
  platform: SocialPlatform;
  state: PlatformPublishState;
  error?: string;
  mayHaveSucceeded?: boolean;
}

export interface PostRecord {
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
