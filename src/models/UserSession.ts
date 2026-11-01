import mongoose, { Schema, models } from 'mongoose';

const UserSessionSchema = new Schema({
  userId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
});

UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UserSession =
  models.UserSession || mongoose.model('UserSession', UserSessionSchema);
