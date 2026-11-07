import { create } from 'zustand';
import { useLeverStore } from '../store/levers.ts';
import { PRESENTER_STEPS } from './script.ts';

interface PresenterState {
  active: boolean; index: number;
  toggle(): void; next(): void; prev(): void; exit(): void;
}

const LAST = PRESENTER_STEPS.length - 1;

export const usePresenterStore = create<PresenterState>((set, get) => ({
  active: false, index: 0,
  toggle: () => { if (get().active) get().exit(); else set({ active: true, index: 0 }); },
  next: () => set((s) => ({ index: Math.min(LAST, s.index + 1) })),
  prev: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
  exit: () => { useLeverStore.getState().reset(); set({ active: false, index: 0 }); },
}));
