import { create } from 'zustand';

const LAST_STEP = 75;
type Speed = 1 | 4 | 16;
type Range = { from: number; to: number } | null;

interface TimeState {
  step: number; playing: boolean; speed: Speed; range: Range;
  setStep(n: number): void; play(): void; pause(): void; setSpeed(s: Speed): void;
  setRange(r: Range): void; advance(steps: number): void;
}

export const useTimeStore = create<TimeState>((set, get) => ({
  step: 0, playing: false, speed: 1, range: null,
  setStep: (n) => {
    const { range } = get();
    const lo = range?.from ?? 0, hi = range?.to ?? LAST_STEP;
    set({ step: Math.min(hi, Math.max(lo, Math.round(n))) });
  },
  play: () => {
    const { step, range } = get();
    const hi = range?.to ?? LAST_STEP;
    set(step >= hi ? { step: range?.from ?? 0, playing: true } : { playing: true });
  },
  pause: () => set({ playing: false }),
  setSpeed: (speed) => set({ speed }),
  setRange: (range) => set({ range }),
  advance: (steps) => {
    const { step, range } = get();
    const hi = range?.to ?? LAST_STEP;
    const next = Math.min(hi, step + steps);
    set(next >= hi ? { step: hi, playing: false } : { step: next });
  },
}));
