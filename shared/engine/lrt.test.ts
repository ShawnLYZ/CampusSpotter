import { beforeAll, describe, expect, it } from 'vitest';
import { computeLrtCrowding } from './lrt.ts';
import { normalWednesday } from '../fixtures/engine/index.ts';
import { makeBundle } from '../fixtures/engine/testkit.ts';
import type { DisruptionRef, Estimate, InputBundle } from './types.ts';

let base: InputBundle;
beforeAll(async () => { base = await normalWednesday(); });

const concert = (attendance: number | null): DisruptionRef => ({
  id: 'c1', type: 'stadium_event', kind: 'concert', title: 'Big Concert', venue: null, startMin: 1140, endMin: 1320,
  expectedAttendance: attendance === null ? null : { value: attendance, label: 'baseline', sourceId: 't' },
});
const est = (key: Estimate['key'], likely: number | number[]): Estimate => ({
  key, disruptionId: 'c1', likely, low: likely, high: likely, unit: '', reasoning: '',
  confidence: 'medium', model: 't', createdAt: '', clamped: false,
});
const curve = (h: number, v: number) => Array.from({ length: 20 }, (_, i) => (i === h ? v : 0));
const full = [est('eventLrtModeShare', 0.45), est('eventArrivalCurve', curve(11, 0.2)), est('eventDepartureCurve', curve(11, 0))];
const R = { boardings: 4000, alightings: 4000 };

describe('computeLrtCrowding', () => {
  it('no event: index 1.0, baseline label', () => {
    const r = computeLrtCrowding(makeBundle(base, { ridership: R }));
    expect(r.normalFlow).toHaveLength(76);
    expect(r.normalFlow[0]).toBe(170);
    expect(r.series.values[0]).toBe(1);
    expect(r.series.labels[0]).toBe('baseline');
    expect(r.series.inputs).toContain('ridership');
    expect(r.series.inputs).toContain('baseline:lrtHourlyProfile');
  });
  it('concert adds event flow and labels ai', () => {
    const r = computeLrtCrowding(makeBundle(base, { ridership: R, disruptions: [concert(65000)], estimates: full }));
    expect(r.eventFlow[44]).toBe(1462.5);
    expect(r.series.values[44]).toBeCloseTo(8.697, 3);
    expect(r.series.labels[44]).toBe('ai');
    expect(r.series.inputs).toContain('estimate:eventLrtModeShare:c1');
    expect(r.series.inputs).toContain('estimate:eventArrivalCurve:c1');
    expect(r.series.inputs).toContain('estimate:eventDepartureCurve:c1');
    expect(r.warnings).toEqual([]);
  });
  it('late-night normal flow is floored at an average hour, so the index stays sane', () => {
    // Hour 17 (midnight) has a 0.005 profile share; 8000 daily → 10/step, floor 8000/24/4 ≈ 83.33/step.
    const late = [est('eventLrtModeShare', 0.45), est('eventArrivalCurve', curve(11, 0)), est('eventDepartureCurve', curve(17, 0.4))];
    const r = computeLrtCrowding(makeBundle(base, { ridership: R, disruptions: [concert(65000)], estimates: late }));
    expect(r.normalFlow[68]).toBe(10);
    expect(r.eventFlow[68]).toBe(2925);
    expect(r.series.values[68]).toBeCloseTo(1 + 2925 / (8000 / 24 / 4), 6);
  });
  it('no event: a quiet late hour still reads 1.0', () => {
    const r = computeLrtCrowding(makeBundle(base, { ridership: R }));
    expect(r.series.values[68]).toBe(1);
  });
  it('step 72 is no_service', () => {
    const r = computeLrtCrowding(makeBundle(base, { ridership: R }));
    expect(r.series.status[72]).toBe('no_service');
    expect(r.series.values[72]).toBeNull();
  });
  it('null ridership: not_enough_data everywhere', () => {
    const r = computeLrtCrowding(makeBundle(base, { ridership: null }));
    expect(r.series.status.every(s => s === 'not_enough_data')).toBe(true);
    expect(r.series.values.every(v => v === null)).toBe(true);
  });
  it('concert without share warns and contributes 0', () => {
    const b = makeBundle(base, { ridership: R, disruptions: [concert(65000)], estimates: full.filter(e => e.key !== 'eventLrtModeShare') });
    const r = computeLrtCrowding(b);
    expect(r.eventFlow.every(v => v === 0)).toBe(true);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].code).toBe('estimate_missing');
    expect(r.warnings[0].metric).toBe('lrtCrowding');
    expect(r.warnings[0].message).toContain('Big Concert');
    expect(r.series.labels[44]).toBe('baseline');
  });
  it('concert without attendance warns', () => {
    const r = computeLrtCrowding(makeBundle(base, { ridership: R, disruptions: [concert(null)], estimates: full }));
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].message).toContain('attendance');
  });
});
