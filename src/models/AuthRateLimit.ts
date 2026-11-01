import mongoose, { Schema, models } from 'mongoose';

const AuthRateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
});

AuthRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthRateLimit =
  models.AuthRateLimit || mongoose.model('AuthRateLimit', AuthRateLimitSchema);
