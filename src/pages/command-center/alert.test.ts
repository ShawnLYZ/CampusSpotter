import { describe, expect, it } from 'vitest';
import type { EarlyWarningItem } from '../../providers/types.ts';
import { pickAlert } from './alert.ts';

const mk = (id: string, o: Partial<EarlyWarningItem>): EarlyWarningItem => ({
  id, title: id, type: 'concert', kind: 'event', venue: null, startAt: '2026-11-10T12:00:00Z', endAt: '2026-11-10T14:00:00Z',
  expectedAttendance: null, attendanceLabel: null, origin: 'rule', status: 'active', override: null,
  riskLevel: 'low', riskReason: null, riskComputedAt: null, topPeaks: [], sources: [], notes: null, daysRemaining: 1, isPast: false,
  ...o,
} as EarlyWarningItem);

describe('pickAlert', () => {
  it('picks the highest risk, ignoring past, dismissed and unrated items', () => {
    const items = [
      mk('low-tomorrow', { riskLevel: 'low', daysRemaining: 1 }),
      mk('crit-30', { riskLevel: 'critical', daysRemaining: 30, startAt: '2026-12-05T00:00:00Z' }),
      mk('high-2', { riskLevel: 'high', daysRemaining: 2 }),
      mk('crit-past', { riskLevel: 'critical', isPast: true }),
      mk('crit-dismissed', { riskLevel: 'critical', status: 'dismissed' }),
      mk('crit-null', { riskLevel: null }),
    ];
    expect(pickAlert(items)?.id).toBe('crit-30');
  });
  it('breaks ties by earliest startAt', () => {
    const a = mk('later', { riskLevel: 'high', startAt: '2026-12-01T00:00:00Z' });
    const b = mk('sooner', { riskLevel: 'high', startAt: '2026-11-20T00:00:00Z' });
    expect(pickAlert([a, b])?.id).toBe('sooner');
  });
  it('returns null when nothing qualifies', () => {
    expect(pickAlert([])).toBeNull();
    expect(pickAlert([mk('p', { isPast: true })])).toBeNull();
  });
});
