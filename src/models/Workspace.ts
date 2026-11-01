import mongoose, { Schema, models } from 'mongoose';

const WorkspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    ownerId: { type: String, required: true },
  },
  { timestamps: true },
);

WorkspaceSchema.index({ ownerId: 1 }, { unique: true });

export const Workspace =
  models.Workspace || mongoose.model('Workspace', WorkspaceSchema);
