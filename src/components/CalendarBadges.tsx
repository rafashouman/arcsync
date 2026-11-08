import { CircleCheck, Clock3, FileText, LoaderCircle, AlertCircle } from 'lucide-react';
import {
  InstagramIcon,
  FacebookIcon,
  TikTokIcon,
  YoutubeIcon,
} from '@/src/components/icons/SocialIcons';
import type { PostRecord, SocialPlatform } from '@/src/types/post';

export const platformDetails: Record<
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
  facebook: {label:'Facebook',icon:FacebookIcon, color:'text-blue-300',},
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

export function PlatformBadges({
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
    <span className="flex flex-wrap items-center gap-1">
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

export function StatusBadge({ post }: { post: PostRecord }) {
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
  const Icon = post.approvalStatus === 'pending' ? Clock3 : post.approvalStatus === 'rejected' || post.publishMayHaveSucceeded ? AlertCircle : {
    draft: FileText, pending: Clock3, published: CircleCheck, processing: LoaderCircle, failed: AlertCircle,
  }[post.status];
  return (
    <span
      title={
        post.errorLog
          ? `${post.publishMayHaveSucceeded ? 'Resultado incerto: ' : ''}${post.errorLog}`
          : undefined
      }
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${details.color}`}
    >
      <Icon size={12} aria-hidden="true"/> {post.publishMayHaveSucceeded ? 'Verificar envio' : details.label}
    </span>
  );
}

