import type { SourceRow } from '@bundle/rows.ts';
import type { SourceInfo } from '../types.ts';

export interface LatestRun { status: string; startedAt: string; finishedAt: string | null }

const HOUR_MS = 3_600_000;

/** A source's freshness: no job is static, a failed latest run is failed, a last success older than twice the interval is stale. */
export function sourceStatus(
  source: SourceRow, latest: LatestRun | null, lastSuccessAt: string | null, now: Date,
): { status: SourceInfo['status']; lastUpdated: string | null; ageHours: number | null } {
  if (source.job_name === null) return { status: 'static', lastUpdated: null, ageHours: null };
  const ageHours = lastSuccessAt === null ? null : (now.getTime() - Date.parse(lastSuccessAt)) / HOUR_MS;
  const base = { lastUpdated: lastSuccessAt, ageHours };
  if (latest?.status === 'failed') return { status: 'failed', ...base };
  const limit = (source.expected_interval_h ?? Infinity) * 2;
  return { status: ageHours === null || ageHours > limit ? 'stale' : 'ok', ...base };
}
