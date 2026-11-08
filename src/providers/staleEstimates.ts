import type { Estimate } from '@engine/index.ts';

/** refreshEstimates returns a plain Estimate[]; a provider flags a result built from saved estimates with a non-interface `stale` property. */
type MaybeStale = Estimate[] & { stale?: boolean };

export function markStale(estimates: Estimate[]): Estimate[] {
  (estimates as MaybeStale).stale = true;
  return estimates;
}

export const isStaleEstimates = (estimates: Estimate[]): boolean => (estimates as MaybeStale).stale === true;
