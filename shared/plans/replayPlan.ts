import type { LeverSet } from '../engine/types.ts';

export const REPLAY_PLAN_4NOV: LeverSet = [
  { kind: 'classesOnline', fromMin: 645, toMin: 1440, blocks: 'all' },
  { kind: 'nonstopLoop', fromMin: 630, toMin: 720 },
  { kind: 'busesAtLrt', buses: 2, atMin: 720 },
  { kind: 'advisory', advisedMin: 720, message: 'leave_before' },
  { kind: 'cafeteria', outletId: 'main', extraCounters: 0, fromMin: 1080, toMin: 1320, closeAtMin: 1320 },
  { kind: 'waitingHall', hallId: 'main-hall', fromMin: 1020, toMin: 1320 },
  { kind: 'acOffInGap', fromMin: 780, toMin: 1440, blocks: 'all' },
];
