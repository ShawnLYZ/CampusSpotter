import { create } from 'zustand';

/** Whether the "How it works" guide panel is open. */
export const useGuide = create<{ isOpen: boolean; open: () => void; close: () => void }>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
