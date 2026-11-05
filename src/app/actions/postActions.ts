'use server';
import { listPostAccounts } from './destinationActions';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/src/libs/authSession';
import { randomUUID } from 'crypto';
import {
  claimDuePost,
  createPostForWorkspace,
  deletePostForWorkspace,
  getPostForWorkspace,
  reschedulePendingPostForWorkspace,
  retryFailedPostForWorkspace,
  reviewPostForWorkspace,
  updatePostForWorkspace,
} from '@/src/data/posts';
import { publishClaimedPost } from '@/src/libs/postPublisher';
import { getWorkspaceContext } from '@/src/data/workspaces';
import type { PostRecord } from '@/src/types/post';
import { getMediaOwnerKey } from '@/src/libs/mediaStorage';
import {
  canRetryPost,
  getPublishingIssue,
  validatePostInput,
} from '@/src/libs/postValidation';
import {
  canCreateWorkspacePosts,
  canReviewWorkspacePosts,
  requiresPostApproval,
} from '@/src/libs/workspacePermissions';
import {
  isValidTimeZone,
  rescheduleIsoToCalendarDay,
} from '@/src/libs/timeZones';

type ActionResult =
  | { success: true; post: PostRecord }
  | { success: false; error: string };

export async function processDuePostsAction(): Promise<{ processed: number }> {
  const user = await getCurrentUser();
  if (!user || process.env.PUBLISHING_ENABLED !== 'true') {
    return { processed: 0 };
  }
  let processed = 0;
  try {
    for (let step = 0; step < 3; step++) {
      const claimed = await claimDuePost(new Date(), randomUUID(), 10 * 60 * 1000);
      if (!claimed) break;
      processed++;
      await publishClaimedPost(claimed);
    }
    if (processed > 0) {
      revalidatePath('/');
      revalidatePath('/calendar');
    }
  } catch (error) {
    console.error('Erro ao processar fila de publicações:', error);
  }
  return { processed };
}

export async function createScheduledPost(
  input: unknown,
  asDraft = false,
  publishNow = false,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  }

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canCreateWorkspacePosts(workspace.role)) {
      return { success: false, error: 'Seu papel não permite criar publicações.' };
    }
    const saveAsDraft = Boolean(asDraft);
    const data = validatePostInput(
      input,
      getMediaOwnerKey(workspace.workspaceId),
      saveAsDraft,
      publishNow ? Date.now() - 60_000 : Date.now(),
    );
    if (typeof data === 'string') {
      return { success: false, error: data };
    }
    if (!saveAsDraft && !data.destinations?.length) return { success:false, error:'Edite o post e selecione as contas de destino.' };
    if (data.destinations?.some(d => d.accountId)) {
      const { accounts } = await listPostAccounts();
      if (data.destinations.some(d => d.accountId && !accounts.some(a => a.id === d.accountId && a.platform === d.platform))) return {success:false,error:'Conta de destino indisponível nesta equipe.'};
    }
    const approvalStatus = !saveAsDraft && requiresPostApproval(workspace.role)
      ? 'pending'
      : 'not_required';
    let post = await createPostForWorkspace(
      workspace.workspaceId,
      user.uid,
      data,
      saveAsDraft ? 'draft' : 'pending',
      approvalStatus,
    );
    if (publishNow && !saveAsDraft && approvalStatus === 'not_required' && process.env.PUBLISHING_ENABLED === 'true') {
      await processDuePostsAction();
      post = (await getPostForWorkspace(workspace.workspaceId, post._id)) ?? post;
    }
    revalidatePath('/');
    revalidatePath('/calendar');
    revalidatePath('/approvals');
    return { success: true, post };
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    return { success: false, error: 'Não foi possível salvar o agendamento.' };
  }
}

export async function updateScheduledPost(
  id: string,
  input: unknown,
  asDraft = false,
  publishNow = false,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  }
  if (typeof id !== 'string' || id.trim().length === 0) {
    return { success: false, error: 'Identificador de agendamento inválido.' };
  }

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canCreateWorkspacePosts(workspace.role)) {
      return { success: false, error: 'Seu papel não permite editar publicações.' };
    }
    const source = await getPostForWorkspace(workspace.workspaceId, id);
    if (!source) {
      return { success: false, error: 'Agendamento não encontrado nesta equipe.' };
    }
    const saveAsDraft = Boolean(asDraft);
    const data = validatePostInput(
      input,
      getMediaOwnerKey(workspace.workspaceId),
      saveAsDraft,
      publishNow ? Date.now() - 60_000 : Date.now(),
      [...source.mediaUrls, ...(source.destinations ?? []).flatMap(d => d.mediaUrls ?? [])],
    );
    if (typeof data === 'string') {
      return { success: false, error: data };
    }
    if (!saveAsDraft && !data.destinations?.length) return { success:false, error:'Edite o post e selecione as contas de destino.' };
    if (data.destinations?.some(d => d.accountId)) {
      const { accounts } = await listPostAccounts();
      if (data.destinations.some(d => d.accountId && !accounts.some(a => a.id === d.accountId && a.platform === d.platform))) return {success:false,error:'Conta de destino indisponível nesta equipe.'};
    }
    const approvalStatus = !saveAsDraft && requiresPostApproval(workspace.role)
      ? 'pending'
      : 'not_required';
    let post = await updatePostForWorkspace(
      workspace.workspaceId,
      id,
      user.uid,
      data,
      saveAsDraft ? 'draft' : 'pending',
      approvalStatus,
    );
    if (!post) {
      return {
        success: false,
        error: 'Agendamento não encontrado ou não pode mais ser alterado.',
      };
    }
    if (publishNow && !saveAsDraft && approvalStatus === 'not_required' && process.env.PUBLISHING_ENABLED === 'true') {
      await processDuePostsAction();
      post = (await getPostForWorkspace(workspace.workspaceId, post._id)) ?? post;
    }

    revalidatePath('/');
    revalidatePath('/calendar');
    revalidatePath('/approvals');
    return { success: true, post };
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    return {
      success: false,
      error: 'Não foi possível atualizar o agendamento.',
    };
  }
}

export async function duplicatePostAsDraft(
  id: string,
  preferredTimeZone: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  }
  if (typeof id !== 'string' || id.trim().length === 0) {
    return { success: false, error: 'Identificador de post inválido.' };
  }

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canCreateWorkspacePosts(workspace.role)) {
      return { success: false, error: 'Seu papel não permite duplicar publicações.' };
    }
    const source = await getPostForWorkspace(workspace.workspaceId, id);
    if (!source) {
      return { success: false, error: 'Post não encontrado nesta conta.' };
    }

    const timeZone =
      typeof source.timeZone === 'string' && isValidTimeZone(source.timeZone)
        ? source.timeZone
        : typeof preferredTimeZone === 'string' &&
            isValidTimeZone(preferredTimeZone)
          ? preferredTimeZone
          : 'UTC';

    const input = validatePostInput(
      {
        destinations: source.destinations?.map(d => ({...d, scheduledFor:undefined})),
        caption: source.caption,
        platforms: source.platforms,
        scheduledFor: null,
        timeZone,
        mediaUrls: source.mediaUrls,
        tiktokTitle: source.tiktokTitle,
        tiktokPrivacyLevel: source.tiktokPrivacyLevel,
        tiktokAllowComments: source.tiktokAllowComments,
        tiktokAllowDuet: source.tiktokAllowDuet,
        tiktokAllowStitch: source.tiktokAllowStitch,
        tiktokCommercialContent: source.tiktokCommercialContent,
        tiktokBrandOrganic: source.tiktokBrandOrganic,
        tiktokBrandContent: source.tiktokBrandContent,
      },
      getMediaOwnerKey(workspace.workspaceId),
      true,
      Date.now(),
      [...source.mediaUrls, ...(source.destinations ?? []).flatMap(d => d.mediaUrls ?? [])],
    );
    if (typeof input === 'string') {
      return { success: false, error: input };
    }

    const post = await createPostForWorkspace(
      workspace.workspaceId,
      user.uid,
      input,
      'draft',
    );
    revalidatePath('/');
    revalidatePath('/calendar');
    return { success: true, post };
  } catch (error) {
    console.error('Erro ao duplicar post como rascunho:', error);
    return { success: false, error: 'Não foi possível duplicar o post.' };
  }
}

export async function retryFailedPost(
  id: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  }
  if (typeof id !== 'string' || id.trim().length === 0) {
    return { success: false, error: 'Identificador de post inválido.' };
  }

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canCreateWorkspacePosts(workspace.role)) {
      return { success: false, error: 'Seu papel não permite tentar novamente a publicação.' };
    }
    const source = await getPostForWorkspace(workspace.workspaceId, id);
    if (!source || !canRetryPost(source)) {
      return {
        success: false,
        error:
          'Somente posts com falhas confirmadas podem ser tentados novamente. Resultados incertos não podem ser reenviados.',
      };
    }

    const failedPlatforms = source.platformStatuses
      ?.filter((record) => record.state === 'failed')
      .map((record) => record.platform);
    const retryPlatforms = failedPlatforms?.length
      ? failedPlatforms
      : source.platforms;
    for (const platform of retryPlatforms) {
      const destination = source.destinations?.find(d => d.platform === platform);
      const destinationCaption = destination?.youtube ? `${destination.youtube.title}\n${destination.youtube.description}` : destination?.caption || source.caption;
      const text = platform === 'tiktok'
        ? source.tiktokTitle?.trim() || destinationCaption
        : destinationCaption;
      const issue = getPublishingIssue(platform, text, source.destinations?.find(d => d.platform === platform)?.mediaUrls ?? source.mediaUrls);
      if (issue) return { success: false, error: issue };
      if (
        platform === 'tiktok' &&
        (!source.tiktokConsentAt || !source.tiktokPrivacyLevel)
      ) {
        return {
          success: false,
          error: 'Edite o post e confirme as opções obrigatórias do TikTok antes de tentar novamente.',
        };
      }
    }

    let post = await retryFailedPostForWorkspace(
      workspace.workspaceId,
      id,
      new Date(),
    );
    if (!post) {
      return {
        success: false,
        error: 'O post mudou de estado ou não pode ser tentado novamente.',
      };
    }
    if (process.env.PUBLISHING_ENABLED === 'true') {
      await processDuePostsAction();
      post = (await getPostForWorkspace(workspace.workspaceId, post._id)) ?? post;
    }

    revalidatePath('/');
    revalidatePath('/calendar');
    return { success: true, post };
  } catch (error) {
    console.error('Erro ao tentar novamente a publicação:', error);
    return {
      success: false,
      error: 'Não foi possível tentar novamente a publicação.',
    };
  }
}

export async function reschedulePostToDay(
  id: string,
  targetDate: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  }
  if (
    typeof id !== 'string' ||
    id.trim().length === 0 ||
    typeof targetDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)
  ) {
    return { success: false, error: 'Post ou data de reagendamento inválidos.' };
  }

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canCreateWorkspacePosts(workspace.role)) {
      return { success: false, error: 'Seu papel não permite reagendar publicações.' };
    }
    const post = await getPostForWorkspace(workspace.workspaceId, id);
    if (!post || post.status !== 'pending' || !post.scheduledFor) {
      return {
        success: false,
        error:
          'Somente posts agendados e ainda não publicados podem ser movidos.',
      };
    }

    if (post.destinations?.some(d => d.scheduledFor)) return {success:false,error:'Este post tem horários por rede. Edite os destinos para reagendar.'};
    const timeZone =
      typeof post.timeZone === 'string' && isValidTimeZone(post.timeZone)
        ? post.timeZone
        : 'UTC';

    const scheduledFor = rescheduleIsoToCalendarDay(
      post.scheduledFor,
      targetDate,
      timeZone,
    );
    if (!scheduledFor) {
      return {
        success: false,
        error: 'Esse dia e horário não existem no fuso do post.',
      };
    }

    const scheduledTimeMs = new Date(scheduledFor).getTime();
    if (Number.isNaN(scheduledTimeMs) || scheduledTimeMs <= Date.now()) {
      return {
        success: false,
        error: 'Escolha um dia que ainda esteja no futuro para este horário.',
      };
    }

    const updated = await reschedulePendingPostForWorkspace(
      workspace.workspaceId,
      id,
      new Date(scheduledFor),
    );
    if (!updated) {
      return {
        success: false,
        error: 'O post mudou de estado e não pode mais ser reagendado.',
      };
    }

    revalidatePath('/');
    revalidatePath('/calendar');
    return { success: true };
  } catch (error) {
    console.error('Erro ao reagendar post:', error);
    return { success: false, error: 'Não foi possível reagendar o post.' };
  }
}

export async function deleteScheduledPost(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  }
  if (typeof id !== 'string' || id.trim().length === 0) {
    return { success: false, error: 'Identificador de agendamento inválido.' };
  }

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canCreateWorkspacePosts(workspace.role)) {
      return { success: false, error: 'Seu papel não permite excluir publicações.' };
    }
    const post = await deletePostForWorkspace(workspace.workspaceId, id);
    if (!post) {
      return {
        success: false,
        error: 'Agendamento não encontrado ou não pode ser excluído.',
      };
    }

    revalidatePath('/');
    revalidatePath('/calendar');
    revalidatePath('/approvals');
    return { success: true, post };
  } catch (error) {
    console.error('Erro ao excluir agendamento:', error);
    return { success: false, error: 'Não foi possível excluir o agendamento.' };
  }
}

export async function reviewWorkspacePost(
  id: string,
  decision: 'approve' | 'reject',
  comment: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Sua sessão expirou. Entre novamente.' };
  }
  if (
    typeof id !== 'string' ||
    !id.trim() ||
    (decision !== 'approve' && decision !== 'reject') ||
    typeof comment !== 'string' ||
    comment.length > 1000
  ) {
    return { success: false, error: 'A decisão ou o comentário de revisão é inválido.' };
  }
  if (decision === 'reject' && !comment.trim()) {
    return { success: false, error: 'Explique o motivo da rejeição.' };
  }

  try {
    const workspace = await getWorkspaceContext(user.uid, user.email);
    if (!canReviewWorkspacePosts(workspace.role)) {
      return { success: false, error: 'Seu papel não permite revisar publicações.' };
    }
    const source = await getPostForWorkspace(workspace.workspaceId, id);
    if (!source || source.approvalStatus !== 'pending') {
      return { success: false, error: 'Esta publicação não está aguardando revisão.' };
    }
    if (source.createdBy === user.uid) {
      return { success: false, error: 'Você não pode aprovar sua própria publicação.' };
    }
    if (
      decision === 'approve' &&
      source.scheduledFor &&
      Date.parse(source.scheduledFor) <= Date.now()
    ) {
      return {
        success: false,
        error: 'O horário agendado já passou. Reagende a publicação antes de aprová-la.',
      };
    }

    const reviewed = await reviewPostForWorkspace(
      workspace.workspaceId,
      id,
      user.uid,
      decision,
      comment.trim(),
    );
    if (!reviewed) {
      return { success: false, error: 'A publicação mudou de estado durante a revisão.' };
    }
    revalidatePath('/');
    revalidatePath('/calendar');
    revalidatePath('/approvals');
    return { success: true };
  } catch (error) {
    console.error('Erro ao revisar publicação:', error);
    return { success: false, error: 'Não foi possível registrar a revisão.' };
  }
}
