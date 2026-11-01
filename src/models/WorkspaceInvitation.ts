import mongoose, { Schema, models } from 'mongoose';

const WorkspaceInvitationSchema = new Schema(
  {
    workspaceId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ['admin', 'editor', 'approver'],
      required: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

WorkspaceInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
WorkspaceInvitationSchema.index({ workspaceId: 1, email: 1 }, { unique: true });

export const WorkspaceInvitation =
  models.WorkspaceInvitation ||
  mongoose.model('WorkspaceInvitation', WorkspaceInvitationSchema);
