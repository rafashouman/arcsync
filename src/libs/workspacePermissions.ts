import type { WorkspaceInviteRole, WorkspaceRole } from '@/src/data/workspaces';

export function canManageWorkspace(role: WorkspaceRole) {
  return role === 'owner' || role === 'admin';
}

export function canCreateWorkspacePosts(role: WorkspaceRole) {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

export function requiresPostApproval(role: WorkspaceRole) {
  return role === 'editor';
}

export function canReviewWorkspacePosts(role: WorkspaceRole) {
  return role === 'owner' || role === 'admin' || role === 'approver';
}

export function canInviteWorkspaceRole(
  inviterRole: WorkspaceRole,
  inviteRole: WorkspaceInviteRole,
) {
  return canManageWorkspace(inviterRole) &&
    (inviterRole === 'owner' || inviteRole !== 'admin');
}
