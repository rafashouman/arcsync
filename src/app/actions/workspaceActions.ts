'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/src/libs/authSession';
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  deleteWorkspaceInvitation,
  getWorkspaceContext,
  hashWorkspaceInvitationToken,
  listWorkspaceMembers,
  removeWorkspaceMember,
  switchActiveWorkspace,
  updateWorkspaceMemberRole,
  type WorkspaceInviteRole,
} from '@/src/data/workspaces';
import {
  canInviteWorkspaceRole,
  canManageWorkspace,
} from '@/src/libs/workspacePermissions';

type WorkspaceActionResult =
  | { success: true }
  | { success: false; error: string };

function isInviteRole(role: unknown): role is WorkspaceInviteRole {
  return role === 'admin' || role === 'editor' || role === 'approver';
}

export async function createWorkspaceInvite(
  email: string,
  role: WorkspaceInviteRole,
): Promise<
  | { success: true; inviteUrl: string }
  | { success: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  if (
    typeof email !== 'string' ||
    email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    !isInviteRole(role)
  ) {
    return { success: false, error: 'Informe um e-mail e um papel válidos.' };
  }

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canInviteWorkspaceRole(workspace.role, role)) {
      return { success: false, error: 'Seu papel não permite convidar com esse nível de acesso.' };
    }
    const members = await listWorkspaceMembers(workspace.workspaceId);
    if (members.some((member) => member.email === email.trim().toLowerCase())) {
      return { success: false, error: 'Esse e-mail já faz parte da equipe.' };
    }

    const baseUrl = process.env.PUBLIC_APP_URL;
    if (!baseUrl) {
      return { success: false, error: 'Configure PUBLIC_APP_URL para criar links de convite.' };
    }
    const appUrl = new URL(baseUrl);
    if (
      appUrl.protocol !== 'https:' &&
      !['localhost', '127.0.0.1'].includes(appUrl.hostname)
    ) {
      return { success: false, error: 'PUBLIC_APP_URL precisa usar HTTPS.' };
    }

    const token = randomBytes(32).toString('base64url');
    await createWorkspaceInvitation({
      workspaceId: workspace.workspaceId,
      email: email.trim().toLowerCase(),
      role,
      tokenHash: hashWorkspaceInvitationToken(token),
      invitedBy: user.uid,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    appUrl.pathname = `/join/${token}`;
    appUrl.search = '';
    appUrl.hash = '';
    revalidatePath('/settings/team');
    return { success: true, inviteUrl: appUrl.toString() };
  } catch (error) {
    console.error('Erro ao criar convite de equipe:', error);
    return { success: false, error: 'Não foi possível criar o convite.' };
  }
}

export async function cancelWorkspaceInvite(email: string): Promise<WorkspaceActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  if (typeof email !== 'string' || email.length > 254) {
    return { success: false, error: 'E-mail do convite inválido.' };
  }
  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canManageWorkspace(workspace.role)) {
      return { success: false, error: 'Seu papel não permite cancelar convites.' };
    }
    const deleted = await deleteWorkspaceInvitation(
      workspace.workspaceId,
      email.trim(),
    );
    if (!deleted) return { success: false, error: 'Convite não encontrado.' };
    revalidatePath('/settings/team');
    return { success: true };
  } catch (error) {
    console.error('Erro ao cancelar convite:', error);
    return { success: false, error: 'Não foi possível cancelar o convite.' };
  }
}

export async function changeWorkspaceMemberRole(
  memberId: string,
  role: WorkspaceInviteRole,
): Promise<WorkspaceActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  if (
    typeof memberId !== 'string' ||
    !/^[a-f\d]{24}$/i.test(memberId) ||
    !isInviteRole(role)
  ) {
    return { success: false, error: 'Membro ou papel inválido.' };
  }
  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canInviteWorkspaceRole(workspace.role, role)) {
      return { success: false, error: 'Seu papel não permite conceder esse acesso.' };
    }
    const updated = await updateWorkspaceMemberRole(
      workspace.workspaceId,
      memberId,
      role,
    );
    if (!updated) return { success: false, error: 'Membro não encontrado.' };
    revalidatePath('/settings/team');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Erro ao alterar papel de membro:', error);
    return { success: false, error: 'Não foi possível alterar o papel.' };
  }
}

export async function removeWorkspaceMemberAction(
  memberId: string,
): Promise<WorkspaceActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  if (
    typeof memberId !== 'string' ||
    !/^[a-f\d]{24}$/i.test(memberId) ||
    memberId === user.uid
  ) {
    return { success: false, error: 'Membro inválido ou protegido.' };
  }
  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canManageWorkspace(workspace.role)) {
      return { success: false, error: 'Seu papel não permite remover membros.' };
    }
    const removed = await removeWorkspaceMember(workspace.workspaceId, memberId);
    if (!removed) return { success: false, error: 'Membro não encontrado.' };
    revalidatePath('/settings/team');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Erro ao remover membro da equipe:', error);
    return { success: false, error: 'Não foi possível remover o membro.' };
  }
}

export async function switchWorkspaceAction(workspaceId: string) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const switched = await switchActiveWorkspace(user.uid, workspaceId);
  if (!switched) redirect('/?workspace=not-found');
  revalidatePath('/');
  revalidatePath('/settings/team');
  redirect('/');
}

export async function acceptWorkspaceInviteAction(token: string) {
  if (
    typeof token !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    redirect('/?invite=invalid');
  }
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  const accepted = await acceptWorkspaceInvitation(
    hashWorkspaceInvitationToken(token),
    user.uid,
    user.email,
  );
  if (!accepted) redirect('/?invite=invalid-or-expired');
  revalidatePath('/');
  revalidatePath('/settings/team');
  redirect('/');
}
