'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PostRecord } from '@/src/types/post';
import { calendarDays } from '@/src/libs/calendarSummary';
import CalendarWeek from './CalendarWeek';
export default function CalendarSummary({ posts }: { posts: PostRecord[] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { const update = () => setNow(new Date()); update(); const timer = window.setInterval(update, 60000); return () => window.clearInterval(timer); }, []);
  return <section className="dashboard-panel my-6" aria-labelledby="summary-title"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="summary-title" className="text-lg font-semibold">Sua semana, de perto</h2><p className="dashboard-muted mt-1 text-sm">3 dias anteriores, hoje e os próximos 3 dias.</p></div><Link href="/calendar" className="dashboard-link">Ver calendário →</Link></div>
    {!now ? <p className="mt-4" role="status">Carregando agenda…</p> : <CalendarWeek days={calendarDays(now, 3, 3)} now={now} posts={posts}/>}
  </section>;
}
