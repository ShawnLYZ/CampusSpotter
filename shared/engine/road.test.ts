import { beforeAll, describe, expect, it } from 'vitest';
import { computeRoad } from './road.ts';
import { normalWednesday } from '../fixtures/engine/index.ts';
import { makeBundle } from '../fixtures/engine/testkit.ts';
import type { DisruptionRef, Estimate, InputBundle } from './types.ts';

let base: InputBundle;
beforeAll(async () => { base = await normalWednesday(); });

const concert = (id: string, startMin = 1080): DisruptionRef => ({
  id, type: 'stadium_event', kind: 'concert', title: id, venue: null, startMin, endMin: startMin + 180, expectedAttendance: null,
});
const uplift = (id: string, likely: number[]): Estimate => ({
  key: 'eventRoadUplift', disruptionId: id, likely, low: likely, high: likely, unit: 'x', reasoning: '',
  confidence: 'medium', model: 't', createdAt: '', clamped: false,
});
const flat = (v: number) => new Array<number>(20).fill(v);

describe('computeRoad', () => {
  it('passes the base ratio through with its label', () => {
    const r = computeRoad(makeBundle(base, { roadRatio: 1.2, weatherMm: flat(0) }));
    expect(r.ratio).toHaveLength(76);
    expect(r.ratio.every(v => v === 1.2)).toBe(true);
    expect(r.labels.every(l => l === 'verified')).toBe(true);
    expect(r.dropFromMin).toBeNull();
  });
  it('multiplies by the uplift and labels it ai', () => {
    const b = makeBundle(base, { roadRatio: 1.2, weatherMm: flat(0), disruptions: [concert('c1')], estimates: [uplift('c1', flat(3))] });
    const r = computeRoad(b);
    expect(r.ratio[0]).toBeCloseTo(3.6);
    expect(r.labels[0]).toBe('ai');
    expect(r.inputs).toContain('estimate:eventRoadUplift:c1');
    expect(r.inputs).toContain('road:' + r.kind);
  });
  it('caps the product of uplifts at 12', () => {
    const b = makeBundle(base, { roadRatio: 1.2, weatherMm: flat(0), disruptions: [concert('c1'), concert('c2')], estimates: [uplift('c1', flat(4)), uplift('c2', flat(4))] });
    expect(computeRoad(b).ratio[0]).toBeCloseTo(1.2 * 12);
  });
  it('skips uplift for reconstructed roads and reference runs', () => {
    const o = { roadRatio: 1.2, weatherMm: flat(0), disruptions: [concert('c1')], estimates: [uplift('c1', flat(3))] };
    const rec = computeRoad(makeBundle(base, { ...o, roadKind: 'reconstructed' }));
    expect(rec.ratio[0]).toBeCloseTo(1.2);
    expect(rec.inputs.some(i => i.startsWith('estimate:'))).toBe(false);
    const ref = computeRoad(makeBundle(base, { ...o, roadKind: 'google' }), { reference: true });
    expect(ref.ratio[0]).toBeCloseTo(1.2);
  });
  it('applies the rain factor at hours at or over the threshold', () => {
    const mm = flat(0); mm[8] = 8;
    const b = makeBundle(base, { roadRatio: 1, weatherMm: mm });
    const r = computeRoad(b);
    const f = b.baseline.rainFactor.value;
    for (let i = 0; i < 76; i++) {
      const wet = i >= 32 && i <= 35;
      expect(r.ratio[i]).toBeCloseTo(wet ? f : 1);
    }
    expect(r.inputs).toContain('weather');
    expect(r.inputs).toContain('baseline:rainFactor');
    expect(r.labels[32]).toBe(weakestOf(b.baseline.rainFactor.label, 'verified'));
    const ref = computeRoad(b, { reference: true });
    expect(ref.ratio[32]).toBeCloseTo(1);
  });
  it('handles an all-null base', () => {
    const nulls = new Array(20).fill(null);
    const w = makeBundle(base, { roadRatio: nulls, weatherMm: flat(0), disruptions: [concert('c1')], estimates: [uplift('c1', flat(3))] });
    const r = computeRoad(w);
    expect(r.ratio[0]).toBe(3);
    expect(r.labels[0]).toBe('ai');
    const n = computeRoad(makeBundle(base, { roadRatio: nulls, weatherMm: flat(0) }));
    expect(n.ratio[0]).toBeNull();
    expect(n.labels[0]).toBeNull();
  });
  it('finds dropFromMin where the ratio first reaches amber', () => {
    const up = flat(1).map((_, i) => (i >= 5 ? 1.5 : 1));
    const b = makeBundle(base, { roadRatio: 1.0, weatherMm: flat(0), disruptions: [concert('c1')], estimates: [uplift('c1', up)] });
    expect(b.settings.thresholds.roadDelay.amberFrom).toBe(1.3);
    expect(computeRoad(b).dropFromMin).toBe(705);
  });
  it('falls back to the earliest event start when amber is never reached', () => {
    const b = makeBundle(base, { roadRatio: 1.0, weatherMm: flat(0), disruptions: [concert('c1', 1100), concert('c2', 1000)] });
    expect(computeRoad(b).dropFromMin).toBe(1000);
  });
  it('warns on typical traffic and missing weather', () => {
    const t = computeRoad(makeBundle(base, { roadKind: 'typical', weatherMm: flat(0) }));
    expect(t.warnings.map(w => w.code)).toContain('traffic_assumed_typical');
    expect(computeRoad(makeBundle(base, { roadKind: 'typical', weatherMm: flat(0) }), { reference: true }).warnings.map(w => w.code)).not.toContain('traffic_assumed_typical');
    const nw = computeRoad(makeBundle(base, { weatherMm: null }));
    expect(nw.warnings.map(w => w.code)).toContain('weather_missing');
    expect(nw.inputs).not.toContain('weather');
  });
});

function weakestOf(a: string, b: string) {
  const rank: Record<string, number> = { verified: 3, baseline: 2, ai: 1 };
  return rank[a] <= rank[b] ? a : b;
}
