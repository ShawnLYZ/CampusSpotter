import type { LeverSet } from '../engine/types.ts';

export const FRIDAY_PRAYER_PLAN: LeverSet = [
  { kind: 'stagger', target: 'start', fromMin: 870, toMin: 900, shifts: { A: 0, B: 10, C: 0, D: 20, E: 30, S: 10, L: 0, U: 20 } },
  { kind: 'cafeteria', outletId: 'main', extraCounters: 1, fromMin: 825, toMin: 870, closeAtMin: null },
  { kind: 'acOffInGap', fromMin: 765, toMin: 870, blocks: 'all' },
];
