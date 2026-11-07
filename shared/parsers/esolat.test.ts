import { describe, it, expect } from 'vitest';
import { parseEsolatYear } from './esolat.ts';

const day = (date: string, dhuhr = '13:00:00') => ({ date, fajr: '05:45:00', dhuhr, asr: '16:20:00', maghrib: '19:25:00', isha: '20:35:00', hijri: 'x', day: 'Jumaat' });

describe('parseEsolatYear', () => {
  it('parses Malay and English month names to ISO dates and minutes', () => {
    const rows = parseEsolatYear({ prayerTime: [day('06-Nov-2026'), day('15-Ogos-2026'), day('31-Dis-2026')] }, '2026-11-06T10:00:00+08:00');
    expect(rows.map((r) => r.date)).toEqual(['2026-11-06', '2026-08-15', '2026-12-31']);
    expect(rows[0].dhuhr_min).toBe(780);
    expect(rows[0].fajr_min).toBe(345);
    expect(rows[0].zone).toBe('WLY01');
    expect(rows[0].fetched_at).toBe('2026-11-06T10:00:00+08:00');
  });
  it('accepts Mac, Mei, Okt and English names', () => {
    const rows = parseEsolatYear({ prayerTime: [day('01-Mac-2026'), day('01-Mei-2026'), day('01-Okt-2026'), day('01-Mar-2026'), day('01-May-2026'), day('01-Oct-2026'), day('01-Aug-2026'), day('01-Dec-2026')] }, 'f');
    expect(rows.map((r) => r.date.slice(5, 7))).toEqual(['03', '05', '10', '03', '05', '10', '08', '12']);
  });
  it('throws on an unknown month', () => {
    expect(() => parseEsolatYear({ prayerTime: [day('01-Xyz-2026')] }, 'f')).toThrow('e-Solat: unknown month Xyz');
  });
});
