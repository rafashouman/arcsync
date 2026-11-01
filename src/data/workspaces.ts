import 'server-only';

import { createHash } from 'crypto';
import { connectDB } from '@/src/libs/mongodb';
import { Account } from '@/src/models/Account';
import { Post } from '@/src/models/Post';
import { User } from '@/src/models/User';
import { Workspace } from '@/src/models/Workspace';
import { WorkspaceInvitation } from '@/src/models/WorkspaceInvitation';
import { WorkspaceMember } from '@/src/models/WorkspaceMember';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'approver';
export type WorkspaceInviteRole = Exclude<WorkspaceRole, 'owner'>;

export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  ownerId: string;
  role: WorkspaceRole;
}

export interface WorkspaceMembership extends WorkspaceContext {
  active: boolean;
}

async function requireDatabase() {
  const db = await connectDB();
  if (!db) throw new Error('MongoDB precisa estar configurado para equipes.');
}

function isObjectId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}

export async function getWorkspaceContext(
  userId: string,
  email: string,
): Promise<WorkspaceContext> {
  await requireDatabase();
  const user = await User.findById(userId)
    .select('activeWorkspaceId email')
    .lean();
  if (!user) throw new Error('Usuário não encontrado.');

  if (user.activeWorkspaceId) {
    const activeMember = await WorkspaceMember.findOne({
      workspaceId: user.activeWorkspaceId,
      userId,
      status: 'active',
    }).lean();
    const activeWorkspace = activeMember
      ? await Workspace.findById(user.activeWorkspaceId).lean()
      : null;
    if (activeMember && activeWorkspace) {
      return {
        workspaceId: String(activeWorkspace._id),
        workspaceName: activeWorkspace.name,
        ownerId: activeWorkspace.ownerId,
        role: activeMember.role as WorkspaceRole,
      };
    }
  }

  const existingMembership = await WorkspaceMember.findOne({
    userId,
    status: 'active',
  })
    .sort({ createdAt: 1 })
    .lean();
  if (existingMembership) {
    const workspace = await Workspace.findById(
      existingMembership.workspaceId,
    ).lean();
    if (workspace) {
      await User.updateOne(
        { _id: userId },
        { $set: { activeWorkspaceId: String(workspace._id) } },
      );
      return {
        workspaceId: String(workspace._id),
        workspaceName: workspace.name,
        ownerId: workspace.ownerId,
        role: existingMembership.role as WorkspaceRole,
      };
    }
  }

  const fallbackEmail = user.email || email;
  const workspace = await Workspace.findOneAndUpdate(
    { ownerId: userId },
    {
      $setOnInsert: {
        ownerId: userId,
        name: `${fallbackEmail.split('@')[0] || 'Meu'} workspace`,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  const workspaceId = String(workspace._id);

  await WorkspaceMember.findOneAndUpdate(
    { workspaceId, userId },
    {
      $setOnInsert: {
        workspaceId,
        userId,
        email: fallbackEmail.toLowerCase(),
        role: 'owner',
        status: 'active',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await Promise.all([
    User.updateOne({ _id: userId }, { $set: { activeWorkspaceId: workspaceId } }),
    Post.updateMany(
      { userId, workspaceId: { $exists: false } },
      { $set: { workspaceId } },
    ),
    Account.updateMany(
      { userId, workspaceId: { $exists: false } },
      { $set: { workspaceId } },
    ),
  ]);

  return {
    workspaceId,
    workspaceName: workspace.name,
    ownerId: workspace.ownerId,
    role: 'owner',
  };
}

export async function listWorkspaceMemberships(
  userId: string,
  activeWorkspaceId: string,
): Promise<WorkspaceMembership[]> {
  await requireDatabase();
  const memberships = await WorkspaceMember.find({
    userId,
    status: 'active',
  })
    .sort({ createdAt: 1 })
    .lean();
  const workspaces = await Workspace.find({
    _id: { $in: memberships.map((member) => member.workspaceId) },
  }).lean();
  const workspaceById = new Map(
    workspaces.map((workspace) => [String(workspace._id), workspace]),
  );
  return memberships.flatMap((member) => {
    const workspace = workspaceById.get(member.workspaceId);
    if (!workspace) return [];
    return [{
      workspaceId: String(workspace._id),
      workspaceName: workspace.name,
      ownerId: workspace.ownerId,
      role: member.role as WorkspaceRole,
      active: String(workspace._id) === activeWorkspaceId,
    }];
  });
}

export async function switchActiveWorkspace(userId: string, workspaceId: string) {
  await requireDatabase();
  if (!isObjectId(workspaceId)) return false;
  const membership = await WorkspaceMember.exists({
    workspaceId,
    userId,
    status: 'active',
  });
  if (!membership) return false;
  const result = await User.updateOne(
    { _id: userId },
    { $set: { activeWorkspaceId: workspaceId } },
  );
  return result.matchedCount === 1;
}

export async function listWorkspaceMembers(workspaceId: string) {
  await requireDatabase();
  const members = await WorkspaceMember.find({ workspaceId, status: 'active' })
    .select('userId email role createdAt')
    .sort({ createdAt: 1 })
    .lean();
  return members.map((member) => ({
    userId: member.userId,
    email: member.email,
    role: member.role as WorkspaceRole,
    createdAt: new Date(member.createdAt).toISOString(),
  }));
}

export async function listWorkspaceInvitations(workspaceId: string) {
  await requireDatabase();
  const invitations = await WorkspaceInvitation.find({
    workspaceId,
    expiresAt: { $gt: new Date() },
  })
    .select('email role expiresAt createdAt')
    .sort({ createdAt: -1 })
    .lean();
  return invitations.map((invitation) => ({
    email: invitation.email,
    role: invitation.role as WorkspaceInviteRole,
    expiresAt: new Date(invitation.expiresAt).toISOString(),
    createdAt: new Date(invitation.createdAt).toISOString(),
  }));
}

export async function getWorkspaceInvitationPreview(tokenHash: string) {
  await requireDatabase();
  const invitation = await WorkspaceInvitation.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  })
    .select('workspaceId email role expiresAt')
    .lean();
  if (!invitation) return null;
  const workspace = await Workspace.findById(invitation.workspaceId)
    .select('name')
    .lean();
  if (!workspace) return null;
  return {
    workspaceName: workspace.name,
    email: invitation.email,
    role: invitation.role as WorkspaceInviteRole,
    expiresAt: new Date(invitation.expiresAt).toISOString(),
  };
}

export async function createWorkspaceInvitation(input: {
  workspaceId: string;
  email: string;
  role: WorkspaceInviteRole;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
}) {
  await requireDatabase();
  await WorkspaceInvitation.deleteOne({
    workspaceId: input.workspaceId,
    email: input.email,
  });
  await WorkspaceInvitation.create(input);
}

export async function acceptWorkspaceInvitation(
  tokenHash: string,
  userId: string,
  email: string,
) {
  await requireDatabase();
  const invitation = await WorkspaceInvitation.findOne({
    tokenHash,
    email: email.toLowerCase(),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!invitation) return false;
  const workspace = await Workspace.findById(invitation.workspaceId).lean();
  if (!workspace) return false;

  await WorkspaceMember.findOneAndUpdate(
    { workspaceId: invitation.workspaceId, userId },
    {
      $setOnInsert: {
        workspaceId: invitation.workspaceId,
        userId,
        email: email.toLowerCase(),
        role: invitation.role,
        status: 'active',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await User.updateOne(
    { _id: userId },
    { $set: { activeWorkspaceId: invitation.workspaceId } },
  );
  await WorkspaceInvitation.deleteOne({ _id: invitation._id });
  return true;
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceInviteRole,
) {
  await requireDatabase();
  const result = await WorkspaceMember.updateOne(
    { workspaceId, userId, role: { $ne: 'owner' }, status: 'active' },
    { $set: { role } },
  );
  return result.matchedCount === 1;
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
) {
  await requireDatabase();
  const result = await WorkspaceMember.deleteOne({
    workspaceId,
    userId,
    role: { $ne: 'owner' },
  });
  return result.deletedCount === 1;
}

export async function deleteWorkspaceInvitation(
  workspaceId: string,
  email: string,
) {
  await requireDatabase();
  const result = await WorkspaceInvitation.deleteOne({
    workspaceId,
    email: email.toLowerCase(),
  });
  return result.deletedCount === 1;
}

export function hashWorkspaceInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
