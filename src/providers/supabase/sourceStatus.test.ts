import { describe, expect, it } from 'vitest';
import type { SourceRow } from '@bundle/rows.ts';
import { sourceStatus } from './sourceStatus.ts';

const NOW = new Date('2026-11-05T12:00:00Z');
const hoursAgo = (h: number): string => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const source = (over: Partial<SourceRow> = {}): SourceRow => ({
  id: 's', name: 'S', label: 'verified', url: null, licence: 'x', job_name: 'sync-weather', expected_interval_h: 3, description: '', ...over,
});

describe('sourceStatus', () => {
  it('is static without a job', () => {
    expect(sourceStatus(source({ job_name: null }), null, null, NOW)).toEqual({ status: 'static', lastUpdated: null, ageHours: null });
  });
  it('is failed when the latest run failed, showing the last success', () => {
    const run = { status: 'failed', startedAt: hoursAgo(1), finishedAt: hoursAgo(1) };
    const r = sourceStatus(source(), run, hoursAgo(5), NOW);
    expect(r.status).toBe('failed');
    expect(r.lastUpdated).toBe(hoursAgo(5));
  });
  it('is stale when the last success is older than twice the interval', () => {
    const run = { status: 'success', startedAt: hoursAgo(7), finishedAt: hoursAgo(7) };
    expect(sourceStatus(source(), run, hoursAgo(7), NOW).status).toBe('stale');
  });
  it('is ok when the last success is recent', () => {
    const run = { status: 'success', startedAt: hoursAgo(2), finishedAt: hoursAgo(2) };
    const r = sourceStatus(source(), run, hoursAgo(2), NOW);
    expect(r.status).toBe('ok');
    expect(r.ageHours).toBeCloseTo(2);
  });
  it('is stale when the job has never succeeded', () => {
    expect(sourceStatus(source(), null, null, NOW)).toEqual({ status: 'stale', lastUpdated: null, ageHours: null });
  });
});
