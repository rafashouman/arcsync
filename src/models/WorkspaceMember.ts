import mongoose, { Schema, models } from 'mongoose';

const WorkspaceMemberSchema = new Schema(
  {
    workspaceId: { type: String, required: true },
    userId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'editor', 'approver'],
      required: true,
    },
    status: { type: String, enum: ['active'], default: 'active' },
  },
  { timestamps: true },
);

WorkspaceMemberSchema.index(
  { workspaceId: 1, userId: 1 },
  { unique: true },
);
WorkspaceMemberSchema.index({ userId: 1, status: 1 });

export const WorkspaceMember =
  models.WorkspaceMember ||
  mongoose.model('WorkspaceMember', WorkspaceMemberSchema);
