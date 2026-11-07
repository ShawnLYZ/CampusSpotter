import { describe, it, expect } from 'vitest';
import { fixtureTables } from './index.ts';
import type { EstimateRow, TrafficRow } from '../../bundle/rows.ts';

const rows = fixtureTables.ai_estimates as EstimateRow[];
const EVENT_KEYS = ['eventRoadUplift', 'eventArrivalCurve', 'eventDepartureCurve', 'eventLrtModeShare', 'attendanceDrop', 'dinnerStayShare', 'advisoryCompliance'];
const CURVES = ['eventArrivalCurve', 'eventDepartureCurve'];
const SCALARS = ['eventLrtModeShare', 'attendanceDrop', 'dinnerStayShare', 'advisoryCompliance'];
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

describe('pre-written estimates', () => {
  it('has all 7 event keys for 4 Nov', () => {
    const keys = rows.filter((r) => r.disruption_id === 'weeknd-2026-11-04').map((r) => r.key).sort();
    expect(keys).toEqual([...EVENT_KEYS].sort());
  });
  it('covers every disruption with fixture metadata', () => {
    for (const id of ['weeknd-2026-11-05', 'bts-2026-12-12', 'bts-2026-12-13']) expect(rows.filter((r) => r.disruption_id === id)).toHaveLength(7);
    for (const id of ['intake-2026-11-12', 'intake-2026-11-19', 'intake-2026-11-24', 'intake-2026-11-26']) expect(rows.filter((r) => r.disruption_id === id).map((r) => r.key)).toEqual(['intakeShuttleDemand']);
    for (const r of rows) {
      expect(r.context_hash).toBe('fixture');
      expect(r.model).toBe('gemini-3.8-flash (pre-written)');
      expect(r.clamped).toBe(false);
      expect(r.date).toBe(r.disruption_id.slice(-10));
    }
  });
  it('curves have 20 points, likely curves sum to 1, low<=likely<=high', () => {
    for (const r of rows.filter((x) => [...CURVES, 'eventRoadUplift'].includes(x.key))) {
      const l = r.likely as number[], lo = r.low as number[], hi = r.high as number[];
      expect(l).toHaveLength(20); expect(lo).toHaveLength(20); expect(hi).toHaveLength(20);
      l.forEach((v, i) => { expect(lo[i]!).toBeLessThanOrEqual(v); expect(v).toBeLessThanOrEqual(hi[i]!); });
      if (CURVES.includes(r.key)) expect(Math.abs(sum(l) - 1)).toBeLessThanOrEqual(0.01);
    }
  });
  it('scalar shares are in [0,1] and ordered', () => {
    for (const r of rows.filter((x) => SCALARS.includes(x.key))) {
      const l = r.likely as number, lo = r.low as number, hi = r.high as number;
      expect(l).toBeGreaterThanOrEqual(0); expect(l).toBeLessThanOrEqual(1);
      expect(lo).toBeLessThanOrEqual(l); expect(l).toBeLessThanOrEqual(hi);
    }
  });
  it('has 40 reconstructed traffic rows for 2026-11-04', () => {
    const t = (fixtureTables.traffic_cache as TrafficRow[]).filter((r) => r.date === '2026-11-04' && r.kind === 'reconstructed');
    expect(t).toHaveLength(40);
    expect(t.every((r) => r.static_duration_s === 360)).toBe(true);
    expect((fixtureTables.traffic_cache as TrafficRow[]).filter((r) => r.kind === 'google')).toHaveLength(40);
  });
});
