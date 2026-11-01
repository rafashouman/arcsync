import { create } from 'zustand';
import type { PostRecord } from '@/src/types/post';

interface SchedulerState {
  isModalOpen: boolean;
  selectedDate: Date | null;
  selectedPost: PostRecord | null;
  openModal: (date: Date, post?: PostRecord) => void;
  closeModal: () => void;
}

export const useSchedulerStore = create<SchedulerState>((set) => ({
  isModalOpen: false,
  selectedDate: null,
  selectedPost: null,
  openModal: (date, post) =>
    set({ isModalOpen: true, selectedDate: date, selectedPost: post ?? null }),
  closeModal: () =>
    set({ isModalOpen: false, selectedDate: null, selectedPost: null }),
}));