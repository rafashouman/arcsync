import { ImageIcon, Film } from 'lucide-react';
import { PlatformBadges, StatusBadge } from './CalendarBadges';
import type { PostRecord } from '@/src/types/post';
import { formatZonedDate, formatZonedTime, isValidTimeZone } from '@/src/libs/timeZones';

export default function PostSummary({post, names}: {post: PostRecord; names: Record<string,string>}) {
  const media = post.mediaUrls[0] || post.destinations?.find(d => d.mediaUrls?.length)?.mediaUrls?.[0];
  const zone = isValidTimeZone(post.timeZone) ? post.timeZone : 'UTC';
  const profiles = post.destinations?.map(d => names[d.accountId] || 'Perfil indisponível').join(' · ');
  return <div className="post-summary">
    <div className="post-art" aria-hidden="true">{!media ? <ImageIcon/> : /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(media) ? <Film/> :
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={media} loading="lazy" alt=""/>}</div>
    <div className="min-w-0 space-y-1.5">
      {post.scheduledFor && <time dateTime={post.scheduledFor} className="dashboard-muted text-xs">{formatZonedDate(post.scheduledFor, zone)} · {formatZonedTime(post.scheduledFor, zone)} ({zone})</time>}
      <p className="line-clamp-2 break-words font-semibold">{post.caption || post.destinations?.find(d => d.caption)?.caption || 'Publicação sem legenda'}</p>
      <div className="flex flex-wrap items-center gap-2"><PlatformBadges platforms={post.platforms} statuses={post.platformStatuses}/><span className="dashboard-muted break-all text-xs">{profiles || 'Perfil padrão'}</span><StatusBadge post={post}/></div>
      {post.errorLog && <p className="text-xs">{post.publishMayHaveSucceeded && 'Resultado incerto · '}{post.errorLog}</p>}
    </div>
  </div>;
}
