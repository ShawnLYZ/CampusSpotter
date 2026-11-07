import { describe, expect, it } from 'vitest';
import type { Summary } from '@engine/index.ts';
import { PRIMARY_METRICS } from '@engine/index.ts';
import { ROW_METRICS, SUMMARY_ROW_LABELS, rowMetrics, summaryRows } from './summaryRows.ts';

const mk = (o: Partial<Summary>): Summary => ({
  peakApuWaitMin: 230, peakLrtWaitMin: 22, totalRedMinutes: 345, studentHoursWaited: 1234.6,
  extraEnergyKwh: 412.4, extraEnergyRm: 1300, totalCostRm: 1300,
  learningDisruption: { sessionsMoved: 12, sessionsScheduled: 40, share: 0.3 },
  ...o,
} as Summary);

describe('summaryRows', () => {
  it('formats the seven rows in order', () => {
    const rows = summaryRows(mk({}), mk({
      peakApuWaitMin: 22, peakLrtWaitMin: null, totalRedMinutes: 0, studentHoursWaited: 10.4,
      extraEnergyKwh: -50.2, extraEnergyRm: -80, totalCostRm: 2600,
      learningDisruption: { sessionsMoved: 0, sessionsScheduled: 40, share: 0 },
    }));
    expect(rows.map((r) => [r.label, r.noAction, r.withPlan])).toEqual([
      ['Peak APU stop wait', '3 h 50 min', '22 min'],
      ['Peak LRT stop wait', '22 min', 'No service'],
      ['Total time in red', '345 min', '0 min'],
      ['Student-hours spent waiting', '1235', '10'],
      ['Extra energy', '412 kWh · RM 1,300', '-50 kWh · −RM 80'],
      ['Total cost', 'RM 1,300', 'RM 2,600'],
      ['Learning disruption', '30% · 12 sessions', 'None'],
    ]);
  });
  it('prints No service for a null APU wait', () => {
    expect(summaryRows(mk({ peakApuWaitMin: null }), mk({}))[0].noAction).toBe('No service');
  });
});

describe('row metrics', () => {
  it('has an entry for every summary row label, and only those', () => {
    const labels = summaryRows(mk({}), mk({})).map((r) => r.label);
    expect(labels).toEqual([...SUMMARY_ROW_LABELS]);
    expect(Object.keys(ROW_METRICS).sort()).toEqual([...SUMMARY_ROW_LABELS].sort());
    for (const l of labels) expect(rowMetrics(l)).not.toBeUndefined();
  });
  it('gives null for the cost row and undefined for an unknown label', () => {
    expect(rowMetrics('Total cost')).toBeNull();
    expect(rowMetrics('Total time in red')).toEqual(PRIMARY_METRICS);
    expect(rowMetrics('toString')).toBeUndefined();
    expect(rowMetrics('Something else')).toBeUndefined();
  });
});
