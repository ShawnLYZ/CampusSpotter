import type { Threshold } from './types.ts';
import type { Pressure } from './output.ts';

export function pressureOf(value: number, t: Threshold): Pressure {
  if (value > t.redAbove) return 'red';
  if (t.greenInclusive ? value > t.amberFrom : value >= t.amberFrom) return 'amber';
  return 'green';
}
