import { describe, it, expect } from 'vitest';
import { routeDepartureTimes, parseRouteDuration, typicalRatioFromRows } from './routes.ts';
import type { TrafficRow } from '../bundle/rows.ts';

describe('routeDepartureTimes', () => {
  const t = routeDepartureTimes('2026-11-18');
  it('has 20 entries', () => expect(t).toHaveLength(20));
  it('hour 0 is 07:00 MYT', () => expect(t[0].departureTimeUtc).toBe('2026-11-17T23:00:00Z'));
  it('hour 17 is 00:00 MYT next day', () => expect(t[17].departureTimeUtc).toBe('2026-11-18T16:00:00Z'));
  it('hour 19 is 02:00 MYT next day', () => expect(t[19].departureTimeUtc).toBe('2026-11-18T18:00:00Z'));
});

describe('parseRouteDuration', () => {
  it('parses seconds strings', () => {
    expect(parseRouteDuration({ routes: [{ duration: '752s', staticDuration: '665s', distanceMeters: 4137, polyline: { encodedPolyline: 'abc' } }] }))
      .toEqual({ durationS: 752, staticDurationS: 665, distanceM: 4137, encodedPolyline: 'abc' });
  });
  it('null polyline when absent', () => {
    expect(parseRouteDuration({ routes: [{ duration: '1s', staticDuration: '1s', distanceMeters: 1 }] }).encodedPolyline).toBeNull();
  });
  it('throws without routes', () => {
    expect(() => parseRouteDuration({})).toThrow();
  });
});

describe('typicalRatioFromRows', () => {
  const mk = (h: number, d: TrafficRow['direction'], dur = 732): TrafficRow =>
    ({ date: '2026-11-18', hour_index: h, direction: d, kind: 'google', duration_s: dur, static_duration_s: 665, fetched_at: 'F' });
  it('20 x 1.101', () => {
    const rows = Array.from({ length: 20 }, (_, h) => [mk(h, 'apu_to_lrt'), mk(h, 'lrt_to_apu')]).flat();
    const r = typicalRatioFromRows(rows);
    expect(r).toHaveLength(20);
    expect(r.every((x) => x === 1.101)).toBe(true);
  });
  it('averages available directions', () => {
    const rows = Array.from({ length: 20 }, (_, h) => mk(h, 'apu_to_lrt', 665));
    rows[3] = mk(3, 'apu_to_lrt', 665 * 2);
    rows.push(mk(3, 'lrt_to_apu', 665));
    expect(typicalRatioFromRows(rows)[3]).toBe(1.5);
  });
  it('throws on missing hour', () => {
    const rows = Array.from({ length: 19 }, (_, h) => mk(h, 'apu_to_lrt'));
    expect(() => typicalRatioFromRows(rows)).toThrow('typical ratio: missing hour 19');
  });
});
