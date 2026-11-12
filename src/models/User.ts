import mongoose, { Schema, models } from 'mongoose';

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      unique: true,
    },
    passwordHash: { type: String, required: true, select: false },
    emailVerified: { type: Boolean, required: true, default: true },
    activeWorkspaceId: { type: String, default: null, index: true },
    analyticsConsent: { type: Boolean, required: true, default: false },
    analyticsConsentUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User = models.User || mongoose.model('User', UserSchema);
