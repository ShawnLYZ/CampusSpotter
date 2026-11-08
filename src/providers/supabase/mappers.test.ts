import { describe, expect, it } from 'vitest';
import { toEarlyWarningItem, type DisruptionWithSources } from './mappers.ts';

const row = (over: Partial<DisruptionWithSources> = {}): DisruptionWithSources => ({
  id: 'd1', title: 'Concert', type: 'stadium_event', kind: 'concert', venue: 'Axiata Arena',
  start_at: '2026-11-12T19:00:00+08:00', end_at: '2026-11-12T23:00:00+08:00', expected_attendance: 8000, attendance_label: 'baseline',
  origin: 'scan', override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
  status: 'active', risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null,
  notes: null, dedupe_key: null, created_by: null, updated_at: '2026-11-05T00:00:00Z', disruption_sources: [], ...over,
});

describe('toEarlyWarningItem', () => {
  it('counts days from today to the effective start', () => {
    const item = toEarlyWarningItem(row(), '2026-11-05');
    expect(item.daysRemaining).toBe(7);
    expect(item.isPast).toBe(false);
  });
  it('marks items that ended before today as past', () => {
    expect(toEarlyWarningItem(row(), '2026-11-20').isPast).toBe(true);
  });
  it('maps override fields and uses them as the effective values', () => {
    const item = toEarlyWarningItem(row({
      override_attendance: 9999, override_start_at: '2026-11-13T19:00:00+08:00', overridden_by: 'u1', overridden_at: '2026-11-06T01:00:00Z',
    }), '2026-11-05');
    expect(item.override).toEqual({
      startAt: '2026-11-13T19:00:00+08:00', endAt: null, expectedAttendance: 9999, by: 'u1', at: '2026-11-06T01:00:00Z',
    });
    expect(item.expectedAttendance).toBe(9999);
    expect(item.attendanceLabel).toBe('verified');
    expect(item.daysRemaining).toBe(8);
  });
  it('has no override when none is set', () => {
    expect(toEarlyWarningItem(row(), '2026-11-05').override).toBeNull();
  });
  it('maps risk_peaks to topPeaks and null to an empty list', () => {
    const peaks = [{ metric: 'lrt_queue', value: 120, atMin: 1100 }];
    const item = toEarlyWarningItem(row({ risk_level: 'high', risk_reason: 'why', risk_peaks: peaks, risk_computed_at: '2026-11-05T01:00:00Z' }), '2026-11-05');
    expect(item).toMatchObject({ riskLevel: 'high', riskReason: 'why', riskComputedAt: '2026-11-05T01:00:00Z', topPeaks: peaks });
    expect(toEarlyWarningItem(row(), '2026-11-05').topPeaks).toEqual([]);
  });
  it('maps sources', () => {
    const item = toEarlyWarningItem(row({ disruption_sources: [{ disruption_id: 'd1', url: 'https://x', title: 'T', published_at: null, fetched_at: 'z' }] }), '2026-11-05');
    expect(item.sources).toEqual([{ url: 'https://x', title: 'T', publishedAt: null }]);
  });
});
