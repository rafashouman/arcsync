'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, LoaderCircle, X } from 'lucide-react';
import { reviewWorkspacePost } from '@/src/app/actions/postActions';
import { PLATFORM_LABELS } from '@/src/libs/publishPlanning';
import type { PostRecord } from '@/src/types/post';

export default function ApprovalQueue({ posts }: { posts: PostRecord[] }) {
  const router = useRouter();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);

  const handleReview = async (
    postId: string,
    decision: 'approve' | 'reject',
  ) => {
    if (workingId) return;
    setWorkingId(postId);
    setMessages((current) => ({ ...current, [postId]: '' }));
    try {
      const result = await reviewWorkspacePost(
        postId,
        decision,
        comments[postId] ?? '',
      );
      if (!result.success) {
        setMessages((current) => ({ ...current, [postId]: result.error }));
        return;
      }
      setMessages((current) => ({
        ...current,
        [postId]: decision === 'approve' ? 'Publicação aprovada.' : 'Publicação devolvida para ajustes.',
      }));
      router.refresh();
    } catch (error) {
      console.error('Não foi possível registrar a revisão:', error);
      setMessages((current) => ({
        ...current,
        [postId]: 'Não foi possível registrar a revisão. Tente novamente.',
      }));
    } finally {
      setWorkingId(null);
    }
  };

  return posts.length === 0 ? (
    <div className="rounded-2xl border border-dashed border-white/10 bg-[#11151f] px-5 py-12 text-center">
      <p className="text-sm font-medium text-slate-300">Nenhuma publicação aguardando aprovação</p>
      <p className="mt-2 text-xs text-slate-500">Novos posts enviados por editores aparecerão aqui.</p>
    </div>
  ) : (
    <div className="space-y-3">
      {posts.map((post) => (
        <article key={post._id} className="rounded-2xl border border-white/[0.07] bg-[#11151f] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              Agendado para{' '}
              {post.scheduledFor
                ? new Date(post.scheduledFor).toLocaleString('pt-BR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: post.timeZone || 'UTC',
                  })
                : 'horário não definido'}
            </p>
            <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[10px] font-medium text-amber-100">
              {post.platforms.map((platform) => PLATFORM_LABELS[platform]).join(' · ')}
            </span>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-200">
            {post.caption || 'Post sem legenda'}
          </p>
          {post.mediaUrls.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              {post.mediaUrls.length} {post.mediaUrls.length === 1 ? 'mídia anexada' : 'mídias anexadas'}
            </p>
          )}
          <label className="mt-5 block text-xs text-slate-400" htmlFor={`review-${post._id}`}>
            Comentário da revisão
            <textarea
              id={`review-${post._id}`}
              maxLength={1000}
              rows={2}
              value={comments[post._id] ?? ''}
              onChange={(event) =>
                setComments((current) => ({
                  ...current,
                  [post._id]: event.target.value,
                }))
              }
              placeholder="Obrigatório para devolver o post"
              className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-[#0c1018] p-3 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
            />
          </label>
          {messages[post._id] && (
            <p role="status" className="mt-3 text-xs text-indigo-100">
              {messages[post._id]}
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={workingId !== null}
              onClick={() => void handleReview(post._id, 'reject')}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-400/20 px-3 text-xs font-medium text-rose-200 transition hover:bg-rose-400/[0.08] disabled:opacity-50"
            >
              {workingId === post._id ? <LoaderCircle size={14} className="animate-spin" /> : <X size={14} />}
              Pedir ajustes
            </button>
            <button
              type="button"
              disabled={workingId !== null}
              onClick={() => void handleReview(post._id, 'approve')}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {workingId === post._id ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
              Aprovar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
