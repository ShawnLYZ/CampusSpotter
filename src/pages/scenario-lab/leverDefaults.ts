import { BLOCK_IDS } from '@engine/index.ts';
import type { InputBundle, Lever, LeverKind } from '@engine/index.ts';

/** Sensible starting values for a lever when its toggle is switched on. */
export function defaultLever(kind: LeverKind, bundle: InputBundle): Lever {
  switch (kind) {
    case 'classesOnline': return { kind, fromMin: 810, toMin: 1440, blocks: 'all' };
    case 'stagger': return { kind, target: 'start', fromMin: 720, toMin: 735, shifts: Object.fromEntries(BLOCK_IDS.map((b) => [b, 10])) };
    case 'extraBuses': return { kind, buses: 1, fromMin: 960, toMin: 1200 };
    case 'nonstopLoop': return { kind, fromMin: 1020, toMin: 1080 };
    case 'busesAtLrt': return { kind, buses: 1, atMin: 1020 };
    case 'cafeteria': return { kind, outletId: bundle.baseline.cafeterias[0].id, extraCounters: 1, fromMin: 690, toMin: 840, closeAtMin: null };
    case 'waitingHall': return { kind, hallId: bundle.baseline.waitingHalls[0].id, fromMin: 1020, toMin: 1320 };
    case 'acOffInGap': return { kind, fromMin: 780, toMin: 1020, blocks: 'all' };
    case 'advisory': return { kind, advisedMin: 1020, message: 'leave_before' };
    case 'studentCount': return { kind, percent: 0 };
  }
}
