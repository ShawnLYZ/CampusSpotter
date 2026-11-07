import { create } from 'zustand';
import type { ContextRequest } from '../providers/types.ts';

interface ContextState {
  ctx: ContextRequest;
  setDate(date: string): void;
  setDisruption(id: string | null): void;
  setCtx(ctx: ContextRequest): void;
}

/** The 4 Nov concert night is the only reconstructed context. */
export function normalise(c: ContextRequest): ContextRequest {
  const rest: ContextRequest = { ...c };
  delete rest.reconstructed;
  return c.date === '2026-11-04' && c.disruptionId === 'weeknd-2026-11-04' ? { ...rest, reconstructed: true } : rest;
}

/** Starts empty; ProviderRoot sets the date from provider.getToday() before any page renders. */
export const useContextStore = create<ContextState>((set) => ({
  ctx: { date: '' },
  setDate: (date) => set({ ctx: normalise({ date }) }),
  setDisruption: (id) => set((s) => ({ ctx: normalise(id === null ? { date: s.ctx.date } : { ...s.ctx, disruptionId: id }) })),
  setCtx: (ctx) => set({ ctx: normalise(ctx) }),
}));
