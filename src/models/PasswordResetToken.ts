import mongoose, { Schema, models } from 'mongoose';

const PasswordResetTokenSchema = new Schema({
  userId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
});

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken =
  models.PasswordResetToken ||
  mongoose.model('PasswordResetToken', PasswordResetTokenSchema);
