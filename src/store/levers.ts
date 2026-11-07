import { create } from 'zustand';
import type { Lever, LeverKind, LeverSet } from '@engine/index.ts';

interface LeverState {
  levers: LeverSet; highlighted: LeverKind[];
  setLevers(l: LeverSet, highlight?: LeverKind[]): void;
  upsert(l: Lever): void;
  remove(kind: LeverKind): void;
  reset(): void;
}

function onePerKind(l: LeverSet): LeverSet {
  const byKind = new Map<LeverKind, Lever>();
  for (const x of l) byKind.set(x.kind, x);
  return [...byKind.values()];
}

export const useLeverStore = create<LeverState>((set) => ({
  levers: [], highlighted: [],
  setLevers: (l, highlight = []) => set({ levers: onePerKind(l), highlighted: highlight }),
  upsert: (l) => set((s) => {
    const i = s.levers.findIndex((x) => x.kind === l.kind);
    return { levers: i < 0 ? [...s.levers, l] : s.levers.map((x, j) => (j === i ? l : x)) };
  }),
  remove: (kind) => set((s) => ({ levers: s.levers.filter((x) => x.kind !== kind), highlighted: s.highlighted.filter((k) => k !== kind) })),
  reset: () => set({ levers: [], highlighted: [] }),
}));
