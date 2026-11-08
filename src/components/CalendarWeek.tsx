import type { PostRecord } from '@/src/types/post';
import { postsOnDay } from '@/src/libs/calendarSummary';
import PublicationDetails from './PublicationDetails';
import { PlatformBadges, StatusBadge } from './CalendarBadges';

interface CalendarWeekProps {
  days: Date[];
  now: Date;
  posts: PostRecord[];
  onEdit?: (post: PostRecord) => void;
  onCreate?: (day: Date) => void;
}

export default function CalendarWeek({ days, now, posts, onEdit, onCreate }: CalendarWeekProps) {
  return <div className="current-week">{days.map(day => {
          const items = postsOnDay(posts, day, Intl.DateTimeFormat().resolvedOptions().timeZone);
          return <div key={day.toDateString()} className={`summary-day ${day.toDateString() === now.toDateString() ? 'is-today' : ''}`}>
            <PublicationDetails label={day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} posts={items} onEdit={onEdit}/>
            {items.slice(0, 3).map(post => <div key={post._id} className="mt-3"><PlatformBadges platforms={post.platforms} statuses={post.platformStatuses}/><p className="mt-1 line-clamp-2 text-xs">{post.caption || 'Sem legenda'}</p><StatusBadge post={post}/></div>)}
            {items.length > 3 && <p className="mt-2 text-xs">+{items.length - 3} nos detalhes</p>}
            {onCreate && <button type="button" className="dashboard-link mt-4 text-xs" onClick={() => onCreate(day)}>+ Criar post</button>}
          </div>;
        })}</div>;
}
