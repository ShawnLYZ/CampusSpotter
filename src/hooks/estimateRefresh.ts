import type { Estimate, InputBundle } from '@engine/index.ts';
import { isStaleEstimates } from '../providers/staleEstimates.ts';

/** What a refreshEstimates call produced: its estimates, or null when it failed. */
export function applyRefresh(bundle: InputBundle, result: Estimate[] | null): { bundle: InputBundle; estimatesStale: boolean } {
  if (result === null) return { bundle, estimatesStale: false };
  if (isStaleEstimates(result)) return { bundle, estimatesStale: true };
  return { bundle: result.length > 0 ? { ...bundle, estimates: result } : bundle, estimatesStale: false };
}
