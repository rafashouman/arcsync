'use client';

import { useSchedulerStore } from '@/src/store/useSchedulerStore';
import type { PostRecord } from '@/src/types/post';

export default function PostButton({ post, children, className }: {
  post?: PostRecord;
  children: React.ReactNode;
  className: string;
}) {
  const openModal = useSchedulerStore(state => state.openModal);
  return <button type="button" className={className} onClick={() => openModal(new Date(post?.scheduledFor ?? Date.now()), post)}>{children}</button>;
}
