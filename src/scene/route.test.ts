import { describe, expect, it } from 'vitest';
import { ROAD_SEGMENTS, routeCurve, segmentAt } from './route.ts';
import { ZONES } from './zones.ts';

describe('route', () => {
  it('runs from the APU stop to the LRT bay', () => {
    const a = routeCurve().getPoint(0), b = routeCurve().getPoint(1);
    expect(a.x).toBeCloseTo(16); expect(a.z).toBeCloseTo(13);
    expect(b.x).toBeCloseTo(-92); expect(b.z).toBeCloseTo(6);
  });
  it('is memoised and long enough', () => {
    expect(routeCurve()).toBe(routeCurve());
    expect(routeCurve().getLength()).toBeGreaterThan(100);
  });
  it('maps t to segments', () => {
    expect(segmentAt(0.1)).toBe('road-jalan-teknologi');
    expect(segmentAt(0.3)).toBe('road-kl-seremban');
    expect(segmentAt(0.9)).toBe('road-jalan-merah-caga');
    expect(segmentAt(1)).toBe('road-jalan-merah-caga');
  });
  it('segments cover [0,1] and reference real zones', () => {
    expect(ROAD_SEGMENTS[0]!.from).toBe(0);
    expect(ROAD_SEGMENTS.at(-1)!.to).toBe(1);
    const ids = new Set(ZONES.map((z) => z.id));
    for (const s of ROAD_SEGMENTS) expect(ids.has(s.zoneId)).toBe(true);
  });
});
