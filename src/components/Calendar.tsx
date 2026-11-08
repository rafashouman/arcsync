'use client';

import { useEffect, useMemo, useState } from 'react';
import PostSummary from './PostSummary';
import PublicationDetails from './PublicationDetails';
import { calendarDays } from '@/src/libs/calendarSummary';
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
import CalendarWeek from './CalendarWeek';
import { platformDetails, PlatformBadges } from './CalendarBadges';
import { processDuePostsAction, reschedulePostToDay } from '@/src/app/actions/postActions';
import { useSchedulerStore } from '@/src/store/useSchedulerStore';
import {
  getDateTimeInputValues,
  formatZonedDate,
  formatZonedTime,
  getZonedDateTimeParts,
  isValidTimeZone,
  rescheduleIsoToCalendarDay,
} from '@/src/libs/timeZones';
import type { PostRecord, SocialPlatform } from '@/src/types/post';

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

export default function SchedulingCalendar({
  initialFilter, names,
  posts = [],
  canCreatePosts = true,
}: {
  initialFilter: string;
  names: Record<string,string>;
  posts?: PostRecord[];
  canCreatePosts?: boolean;
}) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [preferredView, setPreferredView] = useState<'calendar' | 'list' | null>(initialFilter === 'all' ? null : 'list');
  useEffect(() => {
    if (initialFilter !== 'all') return;
    let stored;
    try { stored = localStorage.getItem('arcsync-calendar-view'); } catch {}
    const initial = stored === 'list' || stored === 'calendar' ? stored : window.matchMedia('(max-width: 767px)').matches ? 'list' : 'calendar';
    const frame = requestAnimationFrame(() => setPreferredView(initial));
    return () => cancelAnimationFrame(frame);
  }, [initialFilter]);
  const view = preferredView;
  function setView(value: 'calendar' | 'list') {
    setPreferredView(value);
    try { localStorage.setItem('arcsync-calendar-view', value); } catch {}
  }
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [rescheduleMessage, setRescheduleMessage] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const { openModal } = useSchedulerStore();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const runDueCheck = async () => {
      setNow(new Date());
      const hasDueOrProcessing = posts.some(
        (post) =>
          post.status === 'processing' ||
          (post.status === 'pending' &&
            post.approvalStatus !== 'pending' &&
            post.approvalStatus !== 'rejected' &&
            typeof post.scheduledFor === 'string' &&
            Date.parse(post.scheduledFor) <= Date.now()),
      );
      if (!hasDueOrProcessing) return;
      const result = await processDuePostsAction().catch(() => ({ processed: 0 }));
      if (active && result.processed > 0) {
        router.refresh();
      }
    };
    void runDueCheck();
    const intervalId = window.setInterval(() => {
      void runDueCheck();
    }, 20_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [posts, router]);

  const visiblePosts = useMemo(
    () =>
      posts.filter(
        (post) => {
          const matchesPlatform =
            platformFilter === 'all' || post.platforms.includes(platformFilter);
          const matchesStatus =
            statusFilter === 'all' || post.status === statusFilter || (statusFilter === 'attention' && (post.status === 'failed' || post.publishMayHaveSucceeded));
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
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
  const currentWeek = calendarDays(weekStart, 0, 6);
  const monthPosts = scheduledPosts.filter((post) => {
    const date = getZonedDateTimeParts(post.scheduledFor, getPostTimeZone(post));
    return date.year === year && date.month - 1 === month;
  });
  const allDates = statusFilter !== 'all' && view === 'list';
  const todayKey = getDateTimeInputValues(now, Intl.DateTimeFormat().resolvedOptions().timeZone).date;
  const groups = new Map<string, PostRecord[]>();
  for (const post of view !== 'list' ? [] : allDates ? visiblePosts : monthPosts) {
    const day = post.scheduledFor ? getDateTimeInputValues(post.scheduledFor, getPostTimeZone(post)).date : 'Sem data';
    const group = groups.get(day) ?? [];
    group.push(post);
    groups.set(day, group);
  }
  const orderedDays = [...groups.keys()].sort();
  const renderDay = (day: string) => <section className="agenda-day" key={day}>
    <h3>{day === todayKey ? 'Hoje' : day === 'Sem data' ? day : new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</h3>
    {groups.get(day)?.slice().sort((a,b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? '')).map(post =>
      canCreatePosts ? <button type="button" className="agenda-entry" key={post._id} onClick={() => openModal(getPostDate(post), post)}><PostSummary post={post} names={names}/></button>
        : <article className="agenda-entry" key={post._id}><PostSummary post={post} names={names}/></article>)}
  </section>;
  const pastDays = orderedDays.filter(day => day < todayKey && !allDates && month === now.getMonth() && year === now.getFullYear());
  const scheduledCount = posts.filter((post) => post.status === 'pending').length;
  const draftCount = posts.filter((post) => post.status === 'draft').length;
  const publishedCount = posts.filter((post) => post.status === 'published').length;
  const failedCount = posts.filter((post) => post.status === 'failed' || post.publishMayHaveSucceeded).length;
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
      <div className="hidden gap-3 md:grid md:grid-cols-4">
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

      <section className="dashboard-panel hidden md:block" aria-labelledby="current-week-title">
        <h2 id="current-week-title" className="text-lg font-semibold">Semana atual</h2>
        <p className="dashboard-muted mt-1 text-sm">Passe o mouse, use o teclado ou toque em um dia para ver os detalhes. Os filtros também se aplicam aqui.</p>
        <CalendarWeek days={currentWeek} now={now} posts={visiblePosts}
          onEdit={canCreatePosts ? post => openModal(getPostDate(post), post) : undefined}
          onCreate={canCreatePosts ? day => openModal(day) : undefined}
        />
      </section>
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#11151f] p-4 shadow-xl shadow-black/10 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
                <CalendarDays size={19} />
              </span>
              <div>
                <h2 className="text-lg font-semibold capitalize text-white">
                  {allDates ? 'Agenda' : monthNames[month]} <span className="font-normal text-slate-500">{!allDates && year}</span>
                </h2>
                <p className="text-xs text-slate-500">
                  {allDates ? `${visiblePosts.length} publicações · todas as datas` : `${monthPosts.length} publicações neste mês`}
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
                <option value="facebook">Facebook</option>
              </select>

              <select
                aria-label="Filtrar por status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="h-9 rounded-lg border border-white/10 bg-[#171c28] px-3 text-xs text-slate-300 outline-none transition focus:border-indigo-400/50"
              >
                <option value="all">Todos os status</option>
                <option value="draft">Rascunhos</option>
                <option value="pending">Agendados</option>
                <option value="processing">Publicando</option>
                <option value="published">Publicados</option>
                <option value="attention">Precisam de atenção</option>
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
                  <CalendarDays size={15} className="inline"/> Mês
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
                  <List size={15} className="inline"/> Agenda
                </button>
              </div>

              {canCreatePosts && (
                <button
                  type="button"
                  onClick={openNewPost}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-500 px-3.5 text-xs font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400"
                >
                  <Plus size={15} />
                  Nova publicação
                </button>
              )}
            </div>
          </div>

          <div className={`${allDates ? 'hidden' : 'flex'} mt-6 items-center justify-between border-t border-white/[0.06] pt-4`}>
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
              <div className="min-w-[980px]">
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
                      className="min-h-[170px] rounded-xl bg-white/[0.015]"
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
                        className={`group relative ${currentWeek.some(date => date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) ? 'min-h-[240px] ring-1 ring-indigo-400/40' : 'min-h-[170px]'} rounded-xl border border-white/[0.055] bg-[#171c28]/70 p-1.5 transition hover:border-indigo-400/30 hover:bg-[#1a2030] sm:p-2`}
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
                            className="absolute right-1.5 top-1.5 rounded-md p-1 text-slate-500 opacity-0 transition hover:bg-indigo-400/15 hover:text-indigo-200 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
                          >
                            <Plus size={13} />
                          </button>
                        )}
                        <PublicationDetails label={`${day} de ${monthNames[month]}`} posts={dayPosts} onEdit={canCreatePosts ? post => openModal(getPostDate(post), post) : undefined}/>
                        <div className="mt-1 flex max-h-[130px] flex-col gap-1 overflow-y-auto custom-scrollbar">
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
                                className={`flex w-full flex-wrap items-center gap-1 rounded-md border px-1.5 py-1 text-left text-xs transition hover:brightness-125 ${statusColor}`}
                              >
                                <span className="font-semibold">
                                  {formatZonedTime(post.scheduledFor, getPostTimeZone(post))}
                                </span>
                                <PlatformBadges platforms={post.platforms} statuses={post.platformStatuses}/>
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
                      className="min-h-[170px] rounded-xl bg-white/[0.015]"
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              {pastDays.length > 0 && <details><summary className="dashboard-link cursor-pointer py-2 text-sm">Ver dias anteriores</summary>{pastDays.map(renderDay)}</details>}
              {!allDates && month === now.getMonth() && year === now.getFullYear() && !groups.has(todayKey) && <p className="dashboard-muted py-3 text-sm">Hoje · Nenhuma publicação.</p>}
              {orderedDays.filter(day => !pastDays.includes(day)).map(renderDay)}
              {!orderedDays.length && <p className="dashboard-muted py-4 text-sm">Nenhuma publicação para este período e filtros.</p>}
            </div>
          )}
        </div>

        <aside hidden={allDates} className="rounded-2xl border border-white/[0.07] bg-[#11151f] p-5">
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
