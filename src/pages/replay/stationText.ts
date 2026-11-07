import type { StationDay } from '../../providers/types.ts';

const n = (x: number): string => Math.round(x).toLocaleString('en-US');

/** Verified station box line for the replay day. */
export function stationText(day: Pick<StationDay, 'boardings' | 'alightings' | 'typicalBoardings'>): string {
  const normal = day.typicalBoardings === null ? '' : ` (normal ≈ ${n(day.typicalBoardings)})`;
  return `LRT Bukit Jalil, Wed 4 Nov 2026: ${n(day.alightings)} alightings · ${n(day.boardings)} boardings${normal}`;
}
