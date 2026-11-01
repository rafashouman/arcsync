import type { PlatformPublishRecord } from '@/src/libs/publishPlanning';

export class PlatformPublishError extends Error {
  retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = 'PlatformPublishError';
    this.retryable = retryable;
  }
}

export class ClaimLostError extends Error {
  constructor() {
    super('A reserva do post expirou durante a publicação.');
    this.name = 'ClaimLostError';
  }
}

export type PlatformOutcome =
  | { kind: 'published'; externalId: string }
  | { kind: 'waiting' }
  | { kind: 'retry'; error: string }
  | { kind: 'failed'; error: string; mayHaveSucceeded?: boolean };

export interface PublishContext<TPost> {
  post: TPost;
  record: PlatformPublishRecord | undefined;
  saveRecord: (record: PlatformPublishRecord) => Promise<void>;
}
