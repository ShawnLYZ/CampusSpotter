export type ForecastStatus = 'loading' | 'ready' | 'error';

/** Decides what the Ask box does with a pending explanation. */
export function explainGate(pending: boolean, status: ForecastStatus, hasForecasts: boolean): 'wait' | 'explain' | 'fail' {
  if (!pending) return 'wait';
  if (status === 'error') return 'fail';
  return status === 'ready' && hasForecasts ? 'explain' : 'wait';
}
