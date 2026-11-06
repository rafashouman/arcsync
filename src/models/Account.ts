import mongoose, { Schema, Document, models } from 'mongoose';

export interface IAccount extends Document {
  userId: string;
  workspaceId?: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook';
  platformAccountId: string;
  accountName: string;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  tokenIssuedAt: Date;
  expiresAt: Date | null;
  refreshExpiresAt?: Date;
  permissions: string[];
  isDefault: boolean;
}

const AccountSchema = new Schema<IAccount>({
  userId: { type: String, required: true, index: true },
  workspaceId: { type: String, index: true },
  platform: { type: String, required: true },
  platformAccountId: { type: String, required: true },
  accountName: { type: String, required: true },
  encryptedAccessToken: { type: String, required: true, select: false },
  encryptedRefreshToken: { type: String, select: false },
  tokenIssuedAt: { type: Date, required: true },
  expiresAt: {
    type: Date,
    required: function (this: IAccount | mongoose.Query<unknown, IAccount>) {
      return (this instanceof mongoose.Query ? this.getFilter().platform : this.platform) !== 'facebook';
    },
  },
  refreshExpiresAt: { type: Date },
  permissions: { type: [String], default: [] },
  isDefault: { type: Boolean, default: false, index: true },
}, { timestamps: true });

AccountSchema.index({ userId: 1, platform: 1, platformAccountId: 1 }, { unique: true });
AccountSchema.index(
  { workspaceId: 1, platform: 1, platformAccountId: 1 },
  {
    unique: true,
    partialFilterExpression: { workspaceId: { $type: 'string' } },
  },
);

export const Account = models.Account || mongoose.model<IAccount>('Account', AccountSchema);