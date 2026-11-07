import { describe, it, expect } from 'vitest';
import { fridayPrayerRows, heavyRainRows } from './rules.ts';
import type { PrayerRow, WeatherRow } from './rows.ts';

const prayer = (date: string, dhuhr_min: number): PrayerRow => ({ date, zone: 'WLY01', fajr_min: 0, dhuhr_min, asr_min: 0, maghrib_min: 0, isha_min: 0, fetched_at: 'x' });
const w = (time: string, mm: number | null, p: number | null): WeatherRow => ({ time, precipitation_mm: mm, precipitation_probability: p, fetched_at: 'x' });

describe('fridayPrayerRows', () => {
  it('emits one row per Friday with a prayer row', () => {
    const rows = fridayPrayerRows([prayer('2026-11-06', 780), prayer('2026-11-07', 780), prayer('2026-11-13', 780)], '2026-11-06', '2026-11-20');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'friday-prayer-2026-11-06', type: 'weekly_pattern', kind: 'friday_prayer', start_at: '2026-11-06T12:15:00+08:00', end_at: '2026-11-06T14:45:00+08:00', origin: 'rule', status: 'active', venue: null });
  });
  it('crosses midnight via addDays', () => {
    const rows = fridayPrayerRows([prayer('2026-11-06', 1400)], '2026-11-06', '2026-11-06');
    expect(rows[0].start_at).toBe('2026-11-06T22:35:00+08:00');
    expect(rows[0].end_at).toBe('2026-11-07T01:05:00+08:00');
  });
});

describe('heavyRainRows', () => {
  it('groups qualifying hours per date within the window', () => {
    const rows = heavyRainRows([
      w('2026-11-06T15:00:00+08:00', 8, 90), w('2026-11-06T16:00:00+08:00', 6, 75),
      w('2026-11-06T17:00:00+08:00', 9, 60), w('2026-11-06T23:00:00+08:00', 20, 95),
      w('2026-11-07T10:00:00+08:00', null, 95),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'heavy-rain-2026-11-06', type: 'weather', kind: 'heavy_rain', title: 'Heavy rain forecast', start_at: '2026-11-06T15:00:00+08:00', end_at: '2026-11-06T17:00:00+08:00', origin: 'rule' });
  });
});

describe('heavyRainRows offset handling', () => {
  it('gives the same rows for UTC-expressed times', () => {
    const base = [
      w('2026-11-06T15:00:00+08:00', 8, 90), w('2026-11-06T16:00:00+08:00', 6, 75), w('2026-11-06T23:00:00+08:00', 20, 95),
    ];
    const utc = base.map((r) => ({ ...r, time: new Date(Date.parse(r.time)).toISOString().replace('.000Z', '+00:00') }));
    expect(utc[0].time).toBe('2026-11-06T07:00:00+00:00');
    expect(heavyRainRows(utc)).toEqual(heavyRainRows(base));
    expect(heavyRainRows(utc).map((r) => [r.id, r.start_at, r.end_at])).toEqual([['heavy-rain-2026-11-06', '2026-11-06T15:00:00+08:00', '2026-11-06T17:00:00+08:00']]);
  });
});
