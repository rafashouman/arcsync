'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  List,
  Plus,
  Search,
} from 'lucide-react';
import {
  InstagramIcon,
  TikTokIcon,
  YoutubeIcon,
} from '@/src/components/icons/SocialIcons';
import { reschedulePostToDay } from '@/src/app/actions/postActions';
import { useSchedulerStore } from '@/src/store/useSchedulerStore';
import {
  formatZonedDate,
  formatZonedTime,
  getZonedDateTimeParts,
  isValidTimeZone,
  rescheduleIsoToCalendarDay,
} from '@/src/libs/timeZones';
import type { PostRecord, PostStatus, SocialPlatform } from '@/src/types/post';

const platformDetails: Record<
  SocialPlatform,
  { label: string; icon: typeof InstagramIcon; color: string }
> = {
  instagram: {
    label: 'Instagram',
    icon: InstagramIcon,
    color: 'text-pink-300 bg-pink-400/10 border-pink-400/20',
  },
  tiktok: {
    label: 'TikTok',
    icon: TikTokIcon,
    color: 'text-cyan-200 bg-cyan-400/10 border-cyan-400/20',
  },
  youtube: {
    label: 'YouTube',
    icon: YoutubeIcon,
    color: 'text-red-300 bg-red-400/10 border-red-400/20',
  },
};

const statusDetails = {
  draft: { label: 'Rascunho', color: 'text-slate-300 bg-slate-400/10' },
  pending: { label: 'Agendado', color: 'text-indigo-200 bg-indigo-400/10' },
  processing: { label: 'Publicando', color: 'text-amber-200 bg-amber-400/10' },
  published: { label: 'Publicado', color: 'text-emerald-200 bg-emerald-400/10' },
  failed: { label: 'Falhou', color: 'text-rose-200 bg-rose-400/10' },
} as const;

const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const monthNames = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function getPostTimeZone(post: PostRecord) {
  return isValidTimeZone(post.timeZone)
    ? post.timeZone
    : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function getPostDate(post: PostRecord) {
  return post.scheduledFor ? new Date(post.scheduledFor) : new Date();
}

function PlatformBadges({
  platforms,
  statuses = [],
}: {
  platforms: SocialPlatform[];
  statuses?: PostRecord['platformStatuses'];
}) {
  const stateLabels = {
    uploading: 'Enviando',
    processing: 'Processando',
    published: 'Publicado',
    failed: 'Falhou',
  } as const;
  const stateColors = {
    uploading: 'bg-amber-300',
    processing: 'bg-amber-300',
    published: 'bg-emerald-300',
    failed: 'bg-rose-300',
  } as const;

  return (
    <span className="flex items-center gap-1">
      {platforms.map((platform) => {
        const { icon: Icon, label, color } = platformDetails[platform];
        const status = statuses?.find((item) => item.platform === platform);
        const statusLabel = status
          ? `${status.mayHaveSucceeded ? 'Resultado incerto; ' : ''}${stateLabels[status.state]}${status.error ? `: ${status.error}` : ''}`
          : 'Agendado';
        return (
          <span
            key={platform}
            className={`relative inline-flex h-6 w-6 items-center justify-center rounded-full border ${color}`}
            title={`${label} — ${statusLabel}`}
            aria-label={`${label}: ${statusLabel}`}
          >
            <Icon size={13} />
            {status && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-[#11151f] ${stateColors[status.state]}`}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

function StatusBadge({ post }: { post: PostRecord }) {
  const details =
    post.approvalStatus === 'pending'
      ? {
          label: 'Aguardando aprovação',
          color: 'text-amber-100 bg-amber-300/10',
        }
      : post.approvalStatus === 'rejected'
        ? {
            label: 'Ajustes solicitados',
            color: 'text-rose-100 bg-rose-400/10',
          }
        : statusDetails[post.status];
  return (
    <span
      title={
        post.errorLog
          ? `${post.publishMayHaveSucceeded ? 'Resultado incerto: ' : ''}${post.errorLog}`
          : undefined
      }
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${details.color}`}
    >
      {details.label}
    </span>
  );
}

export default function SchedulingCalendar({
  posts = [],
  canCreatePosts = true,
}: {
  posts?: PostRecord[];
  canCreatePosts?: boolean;
}) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [rescheduleMessage, setRescheduleMessage] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const { openModal } = useSchedulerStore();
  const router = useRouter();

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const visiblePosts = useMemo(
    () =>
      posts.filter(
        (post) => {
          const matchesPlatform =
            platformFilter === 'all' || post.platforms.includes(platformFilter);
          const matchesStatus =
            statusFilter === 'all' || post.status === statusFilter;
          const normalizedQuery = searchQuery.trim().toLocaleLowerCase('pt-BR');
          const searchableText = [
            post.caption,
            ...post.platforms.map((platform) => platformDetails[platform].label),
          ]
            .join(' ')
            .toLocaleLowerCase('pt-BR');
          const matchesSearch =
            !normalizedQuery || searchableText.includes(normalizedQuery);

          return matchesPlatform && matchesStatus && matchesSearch;
        },
      ),
    [posts, platformFilter, statusFilter, searchQuery],
  );

  const upcomingPosts = useMemo(
    () =>
      visiblePosts
        .filter(
          (post): post is PostRecord & { scheduledFor: string } =>
            post.status === 'pending' &&
            typeof post.scheduledFor === 'string' &&
            new Date(post.scheduledFor).getTime() >= now.getTime(),
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledFor).getTime() -
            new Date(b.scheduledFor).getTime(),
        ),
    [visiblePosts, now],
  );

  const drafts = visiblePosts.filter((post) => post.status === 'draft');
  const scheduledPosts = visiblePosts.filter(
    (post): post is PostRecord & { scheduledFor: string } =>
      post.status !== 'draft' && typeof post.scheduledFor === 'string',
  );
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now;
  const monthPosts = scheduledPosts.filter((post) => {
    const date = getZonedDateTimeParts(post.scheduledFor, getPostTimeZone(post));
    return date.year === year && date.month - 1 === month;
  });
  const scheduledCount = posts.filter((post) => post.status === 'pending').length;
  const draftCount = posts.filter((post) => post.status === 'draft').length;
  const publishedCount = posts.filter((post) => post.status === 'published').length;
  const failedCount = posts.filter((post) => post.status === 'failed').length;
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const blanks = Array.from({ length: firstDay }, (_, index) => index);
  const trailingBlanks = Array.from(
    { length: Math.max(0, 42 - firstDay - daysInMonth) },
    (_, index) => index,
  );

  const changeMonth = (amount: number) => {
    setCurrentDate(new Date(year, month + amount, 1));
  };

  const handleDropOnDay = async (postId: string, targetDay: number) => {
    setDraggedPostId(null);
    if (!canCreatePosts || !postId || isRescheduling) return;

    const post = posts.find((item) => item._id === postId);
    if (!post || post.status !== 'pending' || !post.scheduledFor) return;

    const targetDate = `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    const timeZone = getPostTimeZone(post);
    const targetInstant = rescheduleIsoToCalendarDay(
      post.scheduledFor,
      targetDate,
      timeZone,
    );
    if (!targetInstant) {
      setRescheduleMessage('Esse horário não existe nesse dia por causa do fuso horário.');
      return;
    }
    if (new Date(targetInstant).getTime() <= now.getTime()) {
      setRescheduleMessage('Não é possível mover o post para um horário que já passou.');
      return;
    }
    if (targetInstant === post.scheduledFor) return;

    setIsRescheduling(true);
    setRescheduleMessage('');
    try {
      const result = await reschedulePostToDay(postId, targetDate);
      if (!result.success) {
        setRescheduleMessage(result.error);
        return;
      }

      setRescheduleMessage('Post reagendado; o horário local foi preservado.');
      router.refresh();
    } catch (error) {
      console.error('Erro ao reagendar post pelo calendário:', error);
      setRescheduleMessage('Não foi possível reagendar o post. Tente novamente.');
    } finally {
      setIsRescheduling(false);
    }
  };

  const openNewPost = () => {
    if (!canCreatePosts) return;
    openModal(new Date(year, month, Math.min(today.getDate(), daysInMonth)));
  };

  return (
    <section id="calendar" className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-2xl border border-indigo-400/15 bg-gradient-to-br from-indigo-400/[0.09] to-transparent p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
            <Clock3 size={20} />
          </span>
          <div>
            <p className="text-sm text-slate-400">Agendados</p>
            <p className="mt-0.5 text-2xl font-semibold text-white">{scheduledCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-400/[0.07] to-transparent p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <p className="text-sm text-slate-400">Publicados</p>
            <p className="mt-0.5 text-2xl font-semibold text-white">{publishedCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-rose-400/15 bg-gradient-to-br from-rose-400/[0.07] to-transparent p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-400/10 text-rose-300">
            <AlertCircle size={20} />
          </span>
          <div>
            <p className="text-sm text-slate-400">Precisam de atenção</p>
            <p className="mt-0.5 text-2xl font-semibold text-white">{failedCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-400/[0.07] to-transparent p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-400/10 text-slate-300">
            <FileText size={20} />
          </span>
          <div>
            <p className="text-sm text-slate-400">Rascunhos</p>
            <p className="mt-0.5 text-2xl font-semibold text-white">{draftCount}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#11151f] p-4 shadow-xl shadow-black/10 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
                <CalendarDays size={19} />
              </span>
              <div>
                <h2 className="text-lg font-semibold capitalize text-white">
                  {monthNames[month]} <span className="font-normal text-slate-500">{year}</span>
                </h2>
                <p className="text-xs text-slate-500">
                  {monthPosts.length} {monthPosts.length === 1 ? 'post neste mês' : 'posts neste mês'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[180px] flex-1 sm:flex-none">
                <Search
                  size={14}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="search"
                  aria-label="Buscar posts por legenda ou rede social"
                  placeholder="Buscar posts..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-9 w-full rounded-lg border border-white/10 bg-[#171c28] pl-9 pr-3 text-xs text-slate-300 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/50 sm:w-44"
                />
              </label>
              <select
                aria-label="Filtrar por rede social"
                value={platformFilter}
                onChange={(event) =>
                  setPlatformFilter(event.target.value as SocialPlatform | 'all')
                }
                className="h-9 rounded-lg border border-white/10 bg-[#171c28] px-3 text-xs text-slate-300 outline-none transition focus:border-indigo-400/50"
              >
                <option value="all">Todas as redes</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
              </select>

              <select
                aria-label="Filtrar por status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as PostStatus | 'all')
                }
                className="h-9 rounded-lg border border-white/10 bg-[#171c28] px-3 text-xs text-slate-300 outline-none transition focus:border-indigo-400/50"
              >
                <option value="all">Todos os status</option>
                <option value="draft">Rascunhos</option>
                <option value="pending">Agendados</option>
                <option value="processing">Publicando</option>
                <option value="published">Publicados</option>
                <option value="failed">Falhas</option>
              </select>

              <div className="flex rounded-lg border border-white/10 bg-[#171c28] p-0.5">
                <button
                  type="button"
                  aria-label="Visualização de calendário"
                  aria-pressed={view === 'calendar'}
                  onClick={() => setView('calendar')}
                  className={`rounded-md px-2.5 py-1.5 text-xs transition ${
                    view === 'calendar'
                      ? 'bg-indigo-400/15 text-indigo-200'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CalendarDays size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Visualização em lista"
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                  className={`rounded-md px-2.5 py-1.5 text-xs transition ${
                    view === 'list'
                      ? 'bg-indigo-400/15 text-indigo-200'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <List size={15} />
                </button>
              </div>

              {canCreatePosts && (
                <button
                  type="button"
                  onClick={openNewPost}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-500 px-3.5 text-xs font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400"
                >
                  <Plus size={15} />
                  Novo post
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Mês anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:border-indigo-400/40 hover:bg-white/[0.04]"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Próximo mês"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:border-indigo-400/40 hover:bg-white/[0.04]"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          {rescheduleMessage && (
            <p
              role="status"
              className={`mt-3 text-xs ${
                rescheduleMessage.startsWith('Post reagendado')
                  ? 'text-emerald-200'
                  : 'text-amber-200'
              }`}
            >
              {rescheduleMessage}
            </p>
          )}
          {view === 'calendar' && posts.some((post) => post.status === 'pending') && (
            <p className="mt-2 text-[10px] text-slate-600">
              Arraste um post agendado para outro dia para preservar o horário e reagendá-lo.
            </p>
          )}

          {view === 'calendar' ? (
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[650px]">
                <div className="mb-2 grid grid-cols-7">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="pb-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {blanks.map((index) => (
                    <div
                      key={`blank-${index}`}
                      className="min-h-[104px] rounded-xl bg-white/[0.015]"
                    />
                  ))}
                  {days.map((day) => {
                    const isToday =
                      day === today.getDate() &&
                      month === today.getMonth() &&
                      year === today.getFullYear();
                    const dayPosts = scheduledPosts.filter((post) => {
                      const date = getZonedDateTimeParts(
                        post.scheduledFor,
                        getPostTimeZone(post),
                      );
                      return (
                        date.day === day &&
                        date.month - 1 === month &&
                        date.year === year
                      );
                    });

                    return (
                      <div
                        key={day}
                        onDragOver={(event) => {
                          if (draggedPostId) event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const postId = event.dataTransfer.getData('text/plain');
                          void handleDropOnDay(postId, day);
                        }}
                        className="group relative min-h-[104px] rounded-xl border border-white/[0.055] bg-[#171c28]/70 p-1.5 transition hover:border-indigo-400/30 hover:bg-[#1a2030] sm:p-2"
                      >
                        <button
                          type="button"
                          aria-label={`Criar post em ${day} de ${monthNames[month]}`}
                          disabled={!canCreatePosts}
                          onClick={() => openModal(new Date(year, month, day))}
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                            isToday
                              ? 'bg-indigo-500 text-white shadow-md shadow-indigo-950/60'
                              : 'text-slate-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {day}
                        </button>
                        {canCreatePosts && (
                          <button
                            type="button"
                            aria-label={`Adicionar post em ${day}`}
                            onClick={() => openModal(new Date(year, month, day))}
                            className="absolute right-1.5 top-1.5 rounded-md p-1 text-slate-500 opacity-0 transition hover:bg-indigo-400/15 hover:text-indigo-200 group-hover:opacity-100"
                          >
                            <Plus size={13} />
                          </button>
                        )}
                        <div className="mt-1 flex max-h-[58px] flex-col gap-1 overflow-y-auto custom-scrollbar">
                          {dayPosts.map((post) => {
                            const statusColor =
                              post.status === 'failed'
                                ? 'border-rose-400/20 bg-rose-400/[0.09] text-rose-100'
                                : post.status === 'published'
                                  ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100'
                                  : 'border-indigo-400/20 bg-indigo-400/[0.09] text-indigo-100';
                            return (
                              <button
                                type="button"
                                key={post._id}
                                draggable={canCreatePosts && post.status === 'pending' && !isRescheduling}
                                onDragStart={(event) => {
                                  event.dataTransfer.effectAllowed = 'move';
                                  event.dataTransfer.setData('text/plain', post._id);
                                  setDraggedPostId(post._id);
                                }}
                                onDragEnd={() => setDraggedPostId(null)}
                                disabled={!canCreatePosts}
                                onClick={() => openModal(new Date(post.scheduledFor), post)}
                                title={`${formatZonedTime(post.scheduledFor, getPostTimeZone(post))} · ${post.caption || 'Sem legenda'} · ${getPostTimeZone(post)}`}
                                className={`w-full truncate rounded-md border px-1.5 py-1 text-left text-[10px] transition hover:brightness-125 ${statusColor}`}
                              >
                                <span className="font-semibold">
                                  {formatZonedTime(post.scheduledFor, getPostTimeZone(post))}
                                </span>
                                {' · '}
                                {post.caption || 'Sem legenda'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {trailingBlanks.map((index) => (
                    <div
                      key={`trailing-${index}`}
                      className="min-h-[104px] rounded-xl bg-white/[0.015]"
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-white/[0.06]">
              {scheduledPosts.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">
                  {canCreatePosts
                    ? 'Nenhum post agendado para exibir. Crie um agendamento ou consulte seus rascunhos.'
                    : 'Nenhum post agendado para exibir.'}
                </p>
              ) : (
                [...scheduledPosts]
                  .sort(
                    (a, b) =>
                      new Date(a.scheduledFor).getTime() -
                      new Date(b.scheduledFor).getTime(),
                  )
                  .map((post) => (
                    <button
                      type="button"
                      key={post._id}
                      disabled={!canCreatePosts}
                      onClick={() => openModal(getPostDate(post), post)}
                      className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/[0.025] sm:gap-4"
                    >
                      <div className="min-w-[72px] text-xs text-slate-500">
                        <p>{formatZonedDate(post.scheduledFor, getPostTimeZone(post))}</p>
                        <p className="mt-1 font-medium text-slate-300">
                          {formatZonedTime(post.scheduledFor, getPostTimeZone(post))}
                        </p>
                        <p className="mt-1 text-[9px] text-slate-600">
                          {getPostTimeZone(post)}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-200">
                          {post.caption || 'Post sem legenda'}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <PlatformBadges
                            platforms={post.platforms}
                            statuses={post.platformStatuses}
                          />
                          <StatusBadge post={post} />
                        </div>
                        {post.errorLog && (
                          <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-rose-200/75">
                            {post.publishMayHaveSucceeded && 'Resultado incerto: '}
                            {post.errorLog}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-slate-600" />
                    </button>
                  ))
              )}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-white/[0.07] bg-[#11151f] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Próximos posts</h3>
              <p className="mt-1 text-xs text-slate-500">Sua fila de conteúdo</p>
            </div>
            <span className="rounded-lg bg-indigo-400/10 px-2 py-1 text-xs font-medium text-indigo-200">
              {upcomingPosts.length}
            </span>
          </div>

          {upcomingPosts.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
              <CalendarDays size={22} className="mx-auto text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">Sua fila está vazia</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Agende um post para organizar suas próximas publicações.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {upcomingPosts.slice(0, 6).map((post) => (
                <button
                  type="button"
                  key={post._id}
                  disabled={!canCreatePosts}
                  onClick={() => openModal(new Date(post.scheduledFor), post)}
                  className="w-full rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-left transition hover:border-indigo-400/20 hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-indigo-200">
                      {formatZonedDate(post.scheduledFor, getPostTimeZone(post))} · {formatZonedTime(post.scheduledFor, getPostTimeZone(post))}
                    </span>
                    <PlatformBadges
                      platforms={post.platforms}
                      statuses={post.platformStatuses}
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">
                    {post.caption || 'Post sem legenda'}
                  </p>
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Rascunhos</h3>
                <p className="mt-1 text-xs text-slate-500">Conteúdos ainda sem agendamento</p>
              </div>
              <span className="rounded-lg bg-slate-400/10 px-2 py-1 text-xs font-medium text-slate-300">
                {drafts.length}
              </span>
            </div>
            {drafts.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center">
                <FileText size={20} className="mx-auto text-slate-600" />
                <p className="mt-2 text-xs text-slate-500">Nenhum rascunho salvo</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {drafts.slice(0, 5).map((post) => (
                  <button
                    type="button"
                    key={post._id}
                    disabled={!canCreatePosts}
                    onClick={() => openModal(getPostDate(post), post)}
                    className="w-full rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-left transition hover:border-slate-300/20 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-300">
                        Rascunho
                      </span>
                      <PlatformBadges platforms={post.platforms} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">
                      {post.caption || 'Rascunho sem legenda'}
                    </p>
                    {post.mediaUrls.length > 0 && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {post.mediaUrls.length} {post.mediaUrls.length === 1 ? 'mídia' : 'mídias'}
                      </p>
                    )}
                  </button>
                ))}
                {drafts.length > 5 && (
                  <p className="px-1 text-[11px] text-slate-500">
                    + {drafts.length - 5} {drafts.length - 5 === 1 ? 'rascunho' : 'rascunhos'}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-amber-300/10 bg-amber-300/[0.04] p-3">
            <p className="text-[11px] font-semibold text-amber-100">Publicação automática</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Os posts ficam organizados aqui. Conecte as contas sociais para habilitar o envio direto às plataformas.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
