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
    activeWorkspaceId: { type: String, default: null, index: true },
  },
  { timestamps: true },
);

export const User = models.User || mongoose.model('User', UserSchema);
