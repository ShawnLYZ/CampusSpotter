import { describe, it, expect } from 'vitest';
import { parseOpenMeteoHourly } from './openMeteo.ts';

describe('parseOpenMeteoHourly', () => {
  it('maps hourly arrays to rows with +08:00 times', () => {
    const rows = parseOpenMeteoHourly({ hourly: { time: ['2026-11-05T00:00', '2026-11-05T01:00'], precipitation: [0, 7.5], precipitation_probability: [10, 85] } }, 'F');
    expect(rows[1]).toEqual({ time: '2026-11-05T01:00:00+08:00', precipitation_mm: 7.5, precipitation_probability: 85, fetched_at: 'F' });
    expect(rows).toHaveLength(2);
  });
  it('maps missing values to null', () => {
    const rows = parseOpenMeteoHourly({ hourly: { time: ['2026-11-05T00:00'], precipitation: [null], precipitation_probability: [] } }, 'F');
    expect(rows[0].precipitation_mm).toBeNull();
    expect(rows[0].precipitation_probability).toBeNull();
  });
});
