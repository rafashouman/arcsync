'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { PostRecord } from '@/src/types/post';
import { InstagramIcon, FacebookIcon, TikTokIcon, YoutubeIcon } from './icons/SocialIcons';
import { formatZonedTime, isValidTimeZone } from '@/src/libs/timeZones';
const icons = { instagram: InstagramIcon, facebook: FacebookIcon, tiktok: TikTokIcon, youtube: YoutubeIcon };
const statuses = { draft: 'Rascunho', pending: 'Agendado', processing: 'Publicando', published: 'Publicado', failed: 'Falhou' };
export function SocialBadges({ post }: { post: Pick<PostRecord, 'platforms'> }) {
  return <span className="social-badges">{post.platforms.map(platform => { const Icon = icons[platform]; return <span key={platform} title={platform} aria-label={platform}><Icon size={16}/></span>; })}</span>;
}
export default function PublicationDetails({ label, posts, onEdit }: { label: string; posts: PostRecord[]; onEdit?: (post: PostRecord) => void }) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressFocus = useRef(false);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  function cancelHide() { if (hideTimer.current) clearTimeout(hideTimer.current); }
  function close() {
    panel.current?.hidePopover();
    suppressFocus.current = true;
    trigger.current?.focus();
    suppressFocus.current = false;
  }
  const [expanded, setExpanded] = useState(false);
  function show() {
    cancelHide();
    if (suppressFocus.current) return;
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect || !panel.current) return;
    const width = Math.min(360, window.innerWidth - 24);
    panel.current.style.width = `${width}px`;
    panel.current.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    panel.current.style.top = `${Math.max(12, Math.min(rect.bottom + 4, window.innerHeight - Math.min(380, window.innerHeight - 24) - 12))}px`;
    panel.current.showPopover();
  }
  return <div onMouseLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hideTimer.current = setTimeout(() => panel.current?.hidePopover(), 180); }} onKeyDown={event => { if (event.key === 'Escape') { close(); } }}>
    <button ref={trigger} type="button" className="day-details-trigger" aria-expanded={expanded} aria-controls={id} onMouseEnter={show} onFocus={show} onClick={show}>{label}<span>{posts.length} {posts.length === 1 ? 'publicação' : 'publicações'}</span></button>
    <div ref={panel} id={id} popover="auto" className="publication-popover" role="region" aria-label={`Publicações de ${label}`} onMouseEnter={cancelHide} onToggle={event => setExpanded(event.newState === 'open')}>
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{label}</h3><button type="button" aria-label="Fechar detalhes" onClick={() => { close(); }}>✕</button></div>
      {posts.length === 0 ? <p className="dashboard-muted mt-3 text-sm">Nenhuma publicação neste dia.</p> : posts.map(post => <article key={post._id} className="publication-detail">
        <div className="flex flex-wrap items-center justify-between gap-2"><time>{post.scheduledFor && formatZonedTime(post.scheduledFor, isValidTimeZone(post.timeZone) ? post.timeZone : 'UTC')}</time><SocialBadges post={post}/></div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{post.caption || 'Sem legenda'}</p>
        <p className="dashboard-muted mt-2 text-xs">{post.approvalStatus === 'pending' ? 'Aguardando aprovação' : post.approvalStatus === 'rejected' ? 'Ajustes solicitados' : statuses[post.status]} · {post.timeZone || 'UTC'}</p>
        {post.errorLog && <p className="mt-2 text-xs text-rose-300">{post.publishMayHaveSucceeded ? 'Resultado incerto: ' : ''}{post.errorLog}</p>}
        {onEdit && <button type="button" className="dashboard-link mt-3 text-sm" onClick={() => { panel.current?.hidePopover(); onEdit(post); }}>Abrir publicação →</button>}
      </article>)}
    </div>
  </div>;
}
