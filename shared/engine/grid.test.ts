import { describe, it, expect } from 'vitest';
import { stepStartMin, stepOf, interpolateHourly, hourIndexAtStep, hourSlot, addDays, dayOfWeek, calendarDayType, STEPS } from './grid.ts';
import { METRIC_IDS, PRIMARY_METRICS, SECONDARY_METRICS, BLOCK_IDS } from './types.ts';

describe('grid', () => {
  it('has 76 steps from 07:00 to 01:45', () => {
    expect(STEPS).toBe(76); expect(stepStartMin(0)).toBe(420); expect(stepStartMin(75)).toBe(1545);
  });
  it('floors off-grid minutes to their step', () => {
    expect(stepOf(640)).toBe(14); expect(stepOf(645)).toBe(15); expect(stepOf(1560)).toBe(76); expect(stepOf(390)).toBe(-2);
  });
  it('interpolates hourly points', () => {
    const pts = Array.from({ length: 20 }, (_, h) => h * 60);
    expect(interpolateHourly(pts, 2)).toBe(30);           // 07:30
    expect(interpolateHourly(pts, 4)).toBe(60);           // 08:00
    expect(interpolateHourly(pts, 75)).toBeCloseTo(1125); // 01:45 between index 18 and 19
    const gap = [...pts]; gap[5] = null as unknown as number;
    expect(interpolateHourly(gap, 18)).toBeNull();        // 11:30 needs index 4 and 5
    expect(hourIndexAtStep(75)).toBe(18);
  });
  it('maps hours after midnight to the previous context date', () => {
    expect(hourSlot('2026-11-05', 1)).toEqual({ contextDate: '2026-11-04', hourIndex: 18 });
    expect(hourSlot('2026-11-05', 0)).toEqual({ contextDate: '2026-11-04', hourIndex: 17 });
    expect(hourSlot('2026-11-04', 7)).toEqual({ contextDate: '2026-11-04', hourIndex: 0 });
    expect(hourSlot('2026-11-04', 4)).toBeNull();
  });
  it('does calendar arithmetic', () => {
    expect(dayOfWeek('2026-11-04')).toBe(3); expect(dayOfWeek('2026-11-06')).toBe(5);
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01'); expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(calendarDayType('2026-12-12')).toBe('weekend'); expect(calendarDayType('2026-11-06')).toBe('friday');
  });
  it('lists metrics and blocks', () => {
    expect(METRIC_IDS).toHaveLength(9); expect(PRIMARY_METRICS).toHaveLength(7); expect(SECONDARY_METRICS).toEqual(['roadDelay', 'lrtCrowding']);
    expect(BLOCK_IDS).toEqual(['A', 'B', 'C', 'D', 'E', 'S', 'L', 'U']);
  });
});
