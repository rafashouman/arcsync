import mongoose, { Schema, models } from 'mongoose';

const TikTokPostingQuotaSchema = new Schema(
  {
    _id: { type: String, required: true },
    users: {
      type: [
        new Schema(
          {
            userId: { type: String, required: true },
            postedAt: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { versionKey: false },
);

export const TikTokPostingQuota =
  models.TikTokPostingQuota ||
  mongoose.model('TikTokPostingQuota', TikTokPostingQuotaSchema);
