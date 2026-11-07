import { describe, it, expect, beforeAll } from 'vitest';
import { clampEstimate, estimateScalar, estimateCurves, ESTIMATE_KEYS, EVENT_KINDS } from './estimates.ts';
import type { DisruptionRef, Estimate, InputBundle } from './types.ts';
import { normalWednesday } from '../fixtures/engine/index.ts';
import { makeBundle, lab } from '../fixtures/engine/testkit.ts';

let base: InputBundle;
beforeAll(async () => { base = await normalWednesday(); });

const dis = (id: string, kind: DisruptionRef['kind']): DisruptionRef => ({
  id, type: 'manual', kind, title: id, venue: null, startMin: 1000, endMin: 1200, expectedAttendance: lab(1000) });
const est = (key: Estimate['key'], disruptionId: string, likely: number | number[]): Estimate => ({
  key, disruptionId, likely, low: likely, high: likely, unit: 'x', reasoning: '', confidence: 'medium', model: 't', createdAt: 't', clamped: false });

describe('clampEstimate', () => {
  it('has 8 keys', () => { expect(ESTIMATE_KEYS).toHaveLength(8); expect(EVENT_KINDS).toEqual(['concert', 'sports']); });
  it('clamps scalars', () => { expect(clampEstimate('eventLrtModeShare', 0.95)).toEqual({ value: 0.8, clamped: true }); });
  it('normalises arrival curves without counting as clamping', () => {
    const r = clampEstimate('eventArrivalCurve', Array(20).fill(0.1));
    expect((r.value as number[]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(r.clamped).toBe(false);
  });
  it('clamps uplift element-wise', () => {
    const r = clampEstimate('eventRoadUplift', [0.5, ...Array(19).fill(2)]);
    expect((r.value as number[])[0]).toBe(1);
    expect(r.clamped).toBe(true);
  });
  it('throws on wrong length', () => { expect(() => clampEstimate('eventRoadUplift', [1, 2])).toThrow(); });
});

describe('estimateScalar / estimateCurves', () => {
  it('takes the max over matching disruptions', () => {
    const b = makeBundle(base, { disruptions: [dis('a', 'concert'), dis('b', 'concert'), dis('c', 'intake')],
      estimates: [est('attendanceDrop', 'a', 0.2), est('attendanceDrop', 'b', 0.4), est('attendanceDrop', 'c', 0.7)] });
    expect(estimateScalar(b, 'attendanceDrop', EVENT_KINDS)).toEqual({ value: 0.4, disruptionId: 'b' });
    expect(estimateScalar(b, 'attendanceDrop')!.value).toBe(0.7);
    expect(estimateScalar(b, 'dinnerStayShare')).toBeNull();
  });
  it('returns curves for matching disruptions', () => {
    const curve = Array(20).fill(0.05);
    const b = makeBundle(base, { disruptions: [dis('a', 'concert'), dis('c', 'intake')],
      estimates: [est('eventArrivalCurve', 'a', curve), est('eventArrivalCurve', 'c', curve)] });
    expect(estimateCurves(b, 'eventArrivalCurve', EVENT_KINDS)).toEqual([{ curve, disruptionId: 'a' }]);
  });
});
