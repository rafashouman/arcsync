import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import SignOutButton from '@/src/components/SignOutButton';
import { listPostsForWorkspace } from '@/src/data/posts';
import { getWorkspaceContext } from '@/src/data/workspaces';
import { getCurrentUser } from '@/src/libs/authSession';
import {
  getYouTubeAnalytics,
  type YouTubeAnalyticsResult,
} from '@/src/libs/youtubeAnalytics';
import type { PostRecord, SocialPlatform } from '@/src/types/post';

export const metadata: Metadata = {
  title: 'Analytics | FeedSync',
  description: 'Acompanhe publicações e métricas disponíveis no FeedSync.',
};

const platforms: {
  id: SocialPlatform;
  label: string;
  unavailableMessage: string;
}[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    unavailableMessage:
      'Métricas nativas exigem a permissão instagram_business_manage_insights, ainda não solicitada pelo app.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    unavailableMessage:
      'Métricas nativas exigem a permissão video.list, ainda não solicitada pelo app.',
  },
];

function isPublishedOnPlatform(post: PostRecord, platform: SocialPlatform) {
  if (post.platformStatuses?.some(
    (status) => status.platform === platform && status.state === 'published',
  )) {
    return true;
  }
  return post.status === 'published' && !post.platformStatuses?.length &&
    post.platforms.includes(platform);
}

function PlatformActivity({
  posts,
  platform,
  label,
}: {
  posts: PostRecord[];
  platform: SocialPlatform;
  label: string;
}) {
  const published = posts.filter((post) =>
    isPublishedOnPlatform(post, platform),
  ).length;
  const scheduled = posts.filter(
    (post) =>
      post.status === 'pending' &&
      post.approvalStatus !== 'pending' &&
      post.approvalStatus !== 'rejected' &&
      post.platforms.includes(platform) &&
      !post.platformStatuses?.some(
        (status) => status.platform === platform && status.state === 'published',
      ),
  ).length;
  const failed = posts.filter(
    (post) =>
      post.platformStatuses?.some(
        (status) => status.platform === platform && status.state === 'failed',
      ) ||
      (post.status === 'failed' &&
        !post.platformStatuses?.length &&
        post.platforms.includes(platform)),
  ).length;

  return (
    <article className="rounded-2xl border border-white/[0.07] bg-[#11151f] p-5">
      <h2 className="font-semibold text-white">{label}</h2>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-[11px] text-slate-500">Publicados</dt>
          <dd className="mt-1 text-xl font-semibold text-emerald-200">{published}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Agendados</dt>
          <dd className="mt-1 text-xl font-semibold text-indigo-200">{scheduled}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Falhas</dt>
          <dd className="mt-1 text-xl font-semibold text-rose-200">{failed}</dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs leading-5 text-slate-500">
        Contagem das publicações registradas pelo FeedSync; não representa alcance
        ou engajamento.
      </p>
    </article>
  );
}

function YouTubePerformance({ analytics }: { analytics: YouTubeAnalyticsResult }) {
  if (analytics.state !== 'ready') {
    return (
      <article className="rounded-2xl border border-white/[0.07] bg-[#11151f] p-5">
        <h2 className="font-semibold text-white">YouTube · métricas nativas</h2>
        <p className="mt-3 text-sm leading-6 text-amber-100">{analytics.message}</p>
        <Link
          href="/settings/accounts"
          className="mt-4 inline-flex text-xs font-medium text-indigo-300 transition hover:text-indigo-200"
        >
          Ver contas sociais
        </Link>
      </article>
    );
  }

  const { totals } = analytics;
  const number = (value: number | null) =>
    value === null
      ? '—'
      : new Intl.NumberFormat('pt-BR').format(value);

  return (
    <article className="rounded-2xl border border-red-400/10 bg-gradient-to-br from-red-400/[0.05] to-[#11151f] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-white">YouTube · métricas nativas</h2>
          <p className="mt-1 text-xs text-slate-500">
            {analytics.trackedVideoCount === 0
              ? 'Nenhum vídeo publicado pelo FeedSync para consultar.'
              : `Dados atuais de ${totals.videoCount} de até ${analytics.trackedVideoCount} vídeos do FeedSync.`}
          </p>
        </div>
        <BarChart3 size={18} className="text-red-200" />
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-[11px] text-slate-500">Visualizações</dt>
          <dd className="mt-1 text-xl font-semibold text-white">{number(totals.views)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Gostei</dt>
          <dd className="mt-1 text-xl font-semibold text-white">{number(totals.likes)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Comentários</dt>
          <dd className="mt-1 text-xl font-semibold text-white">{number(totals.comments)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">Vídeos com dados</dt>
          <dd className="mt-1 text-xl font-semibold text-white">{number(totals.videoCount)}</dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs leading-5 text-slate-500">
        Totais acumulados atuais, atualizados ao abrir esta página. Não são
        métricas de um período específico; o YouTube pode ocultar contagens de
        gostei ou comentários.
      </p>
    </article>
  );
}

async function AnalyticsContent() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const workspace = await getWorkspaceContext(user.uid, user.email);
  const [posts, youtubeAnalytics] = await Promise.all([
    listPostsForWorkspace(workspace.workspaceId),
    getYouTubeAnalytics(workspace.workspaceId),
  ]);
  const scheduledCount = posts.filter(
    (post) =>
      post.status === 'pending' &&
      post.approvalStatus !== 'pending' &&
      post.approvalStatus !== 'rejected',
  ).length;
  const publishedCount = posts.filter((post) => post.status === 'published').length;
  const failedCount = posts.filter((post) => post.status === 'failed').length;

  return (
    <main className="min-h-screen px-4 py-6 text-slate-200 sm:px-7 sm:py-9">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Voltar ao início
          </Link>
          <SignOutButton email={user.email} />
        </header>

        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
            {workspace.workspaceName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Analytics</h1>
          <p className="mt-2 text-sm text-slate-400">
            Atividade do calendário e métricas de desempenho liberadas pelas
            contas conectadas.
          </p>
        </div>

        <section
          aria-label="Resumo das publicações"
          className="mb-6 grid gap-3 sm:grid-cols-3"
        >
          <div className="rounded-2xl border border-indigo-400/15 bg-indigo-400/[0.04] p-4">
            <p className="text-xs text-slate-400">Agendados</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-100">{scheduledCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4">
            <p className="text-xs text-slate-400">Publicados</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-100">{publishedCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.04] p-4">
            <p className="text-xs text-slate-400">Com falha</p>
            <p className="mt-1 text-2xl font-semibold text-rose-100">{failedCount}</p>
          </div>
        </section>

        <section aria-label="Atividade por rede social" className="grid gap-4 md:grid-cols-3">
          {platforms.map((platform) => (
            <PlatformActivity
              key={platform.id}
              posts={posts}
              platform={platform.id}
              label={platform.label}
            />
          ))}
          <PlatformActivity
            posts={posts}
            platform="youtube"
            label="YouTube"
          />
        </section>

        <section aria-labelledby="performance-title" className="mt-8 space-y-4">
          <div>
            <h2 id="performance-title" className="text-lg font-semibold text-white">
              Desempenho nas plataformas
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Os dados são limitados às permissões aprovadas para cada API; o
              FeedSync não estima métricas ausentes.
            </p>
          </div>
          <YouTubePerformance analytics={youtubeAnalytics} />
          <div className="grid gap-4 md:grid-cols-2">
            {platforms.map((platform) => (
              <article
                key={platform.id}
                className="rounded-2xl border border-white/[0.07] bg-[#11151f] p-5"
              >
                <h3 className="font-semibold text-white">{platform.label} · métricas nativas</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {platform.unavailableMessage}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Carregando analytics...
        </main>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
