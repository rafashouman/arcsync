import mongoose, { Schema, models } from 'mongoose';

const EmailVerificationTokenSchema = new Schema({
  userId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
});

EmailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailVerificationToken =
  models.EmailVerificationToken ||
  mongoose.model('EmailVerificationToken', EmailVerificationTokenSchema);
