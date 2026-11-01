'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Copy,
  LoaderCircle,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  cancelWorkspaceInvite,
  changeWorkspaceMemberRole,
  createWorkspaceInvite,
  removeWorkspaceMemberAction,
  switchWorkspaceAction,
} from '@/src/app/actions/workspaceActions';
import type {
  WorkspaceInviteRole,
  WorkspaceMembership,
  WorkspaceRole,
} from '@/src/data/workspaces';

interface TeamMember {
  userId: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
}

interface TeamInvitation {
  email: string;
  role: WorkspaceInviteRole;
  expiresAt: string;
  createdAt: string;
}

const roleLabels: Record<WorkspaceRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  editor: 'Editor',
  approver: 'Aprovador',
};

const inviteRoles: WorkspaceInviteRole[] = ['admin', 'editor', 'approver'];

export default function WorkspaceTeamPanel({
  workspaceName,
  currentUserId,
  role,
  memberships,
  members,
  invitations,
}: {
  workspaceName: string;
  currentUserId: string;
  role: WorkspaceRole;
  memberships: WorkspaceMembership[];
  members: TeamMember[];
  invitations: TeamInvitation[];
}) {
  const canManage = role === 'owner' || role === 'admin';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceInviteRole>('editor');
  const [inviteUrl, setInviteUrl] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage('');
    const result = await createWorkspaceInvite(email, inviteRole);
    if (result.success) {
      setInviteUrl(result.inviteUrl);
      setEmail('');
      setMessage('Convite criado. Compartilhe o link com a pessoa convidada.');
      router.refresh();
    } else {
      setMessage(result.error);
    }
    setIsSubmitting(false);
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage('Link copiado.');
    } catch (error) {
      console.error('Não foi possível copiar o link do convite:', error);
      setMessage('Selecione e copie o link exibido.');
    }
  };

  const handleRoleChange = async (
    memberId: string,
    nextRole: WorkspaceInviteRole,
  ) => {
    const result = await changeWorkspaceMemberRole(memberId, nextRole);
    setMessage(result.success ? 'Papel atualizado.' : result.error);
    if (result.success) router.refresh();
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!window.confirm(`Remover ${memberEmail} deste workspace?`)) return;
    const result = await removeWorkspaceMemberAction(memberId);
    setMessage(result.success ? 'Membro removido.' : result.error);
    if (result.success) router.refresh();
  };

  const handleCancelInvite = async (inviteEmail: string) => {
    const result = await cancelWorkspaceInvite(inviteEmail);
    setMessage(result.success ? 'Convite cancelado.' : result.error);
    if (result.success) router.refresh();
  };

  return (
    <div className="space-y-5">
      {memberships.length > 1 && (
        <section className="rounded-2xl border border-white/[0.07] bg-[#11151f] p-5">
          <label className="block text-xs font-medium text-slate-300">
            Workspace ativo
            <select
              value={memberships.find((membership) => membership.active)?.workspaceId}
              onChange={(event) => void switchWorkspaceAction(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0c1018] px-3 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
            >
              {memberships.map((membership) => (
                <option key={membership.workspaceId} value={membership.workspaceId}>
                  {membership.workspaceName} · {roleLabels[membership.role]}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      <section className="rounded-2xl border border-white/[0.07] bg-[#11151f] p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
            <Users size={18} />
          </span>
          <div>
            <h2 className="font-semibold text-white">{workspaceName}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {members.length} {members.length === 1 ? 'membro' : 'membros'} · contas sociais e publicações são compartilhadas.
            </p>
          </div>
        </div>

        {message && (
          <p role="status" className="mt-4 rounded-lg bg-indigo-400/[0.07] p-3 text-xs text-indigo-100">
            {message}
          </p>
        )}

        {canManage && (
          <form onSubmit={handleInvite} className="mt-6 grid gap-2 border-t border-white/[0.06] pt-5 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
            <label className="sr-only" htmlFor="invite-email">E-mail do membro</label>
            <input
              id="invite-email"
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="pessoa@empresa.com"
              className="h-10 rounded-lg border border-white/10 bg-[#0c1018] px-3 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
            />
            <label className="sr-only" htmlFor="invite-role">Papel do membro</label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as WorkspaceInviteRole)}
              className="h-10 rounded-lg border border-white/10 bg-[#0c1018] px-3 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
            >
              {inviteRoles
                .filter((invite) => role === 'owner' || invite !== 'admin')
                .map((invite) => (
                  <option key={invite} value={invite}>{roleLabels[invite]}</option>
                ))}
            </select>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {isSubmitting ? <LoaderCircle size={15} className="animate-spin" /> : <UserPlus size={15} />}
              Convidar
            </button>
          </form>
        )}

        {inviteUrl && (
          <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3">
            <label className="text-[11px] text-emerald-100" htmlFor="invite-url">
              Link de uso único (expira em 7 dias)
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="invite-url"
                readOnly
                value={inviteUrl}
                onFocus={(event) => event.currentTarget.select()}
                className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0c1018] px-2 text-xs text-slate-200"
              />
              <button
                type="button"
                onClick={() => void handleCopyInvite()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-slate-200 hover:bg-white/[0.05]"
              >
                {message === 'Link copiado.' ? <Check size={14} /> : <Copy size={14} />}
                Copiar
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <h3 className="text-sm font-medium text-slate-200">Membros</h3>
          <div className="mt-3 space-y-2">
            {members.map((member) => (
              <div key={member.userId} className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-100">{member.email}</p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {member.userId === currentUserId ? 'Você · ' : ''}{roleLabels[member.role]}
                  </p>
                </div>
                {canManage && member.role !== 'owner' && (
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      disabled={role === 'admin' && member.role === 'admin'}
                      onChange={(event) => void handleRoleChange(member.userId, event.target.value as WorkspaceInviteRole)}
                      aria-label={`Papel de ${member.email}`}
                      className="h-8 rounded-lg border border-white/10 bg-[#0c1018] px-2 text-xs text-slate-200"
                    >
                      {inviteRoles
                        .filter((invite) => role === 'owner' || invite !== 'admin')
                        .map((invite) => (
                          <option key={invite} value={invite}>{roleLabels[invite]}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleRemoveMember(member.userId, member.email)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-400/15 px-2 text-[11px] text-rose-200 hover:bg-rose-400/[0.08]"
                    >
                      <Trash2 size={13} />
                      Remover
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {canManage && invitations.length > 0 && (
          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <h3 className="text-sm font-medium text-slate-200">Convites pendentes</h3>
            <div className="mt-3 space-y-2">
              {invitations.map((invitation) => (
                <div key={invitation.email} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div>
                    <p className="text-sm text-slate-100">{invitation.email}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {roleLabels[invitation.role]} · expira {new Date(invitation.expiresAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCancelInvite(invitation.email)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-400/15 px-2 text-[11px] text-rose-200 hover:bg-rose-400/[0.08]"
                  >
                    <Trash2 size={13} />
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-5 text-slate-500">
        Proprietários e administradores gerenciam contas sociais e membros.
        Editores criam posts que aguardam aprovação. Aprovadores revisam o
        conteúdo; contas conectadas e publicações são compartilhadas.
      </section>
    </div>
  );
}
