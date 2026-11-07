import { describe, expect, it } from 'vitest';
import { addDays, fromLocalInput, mytClock, mytDate, mytMinutes, toLocalInput } from './dates.ts';

describe('dates', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-11-05', -5)).toBe('2026-10-31');
  });
  it('converts to MYT date and clock', () => {
    expect(mytDate('2026-11-04T17:00:00Z')).toBe('2026-11-05');
    expect(mytClock('2026-11-04T10:45:00Z')).toBe('18:45');
    expect(mytMinutes('2026-11-04T10:45:00Z')).toBe(18 * 60 + 45);
  });
  it('round-trips datetime-local values', () => {
    expect(toLocalInput('2026-11-04T10:45:00Z')).toBe('2026-11-04T18:45');
    expect(fromLocalInput('2026-11-04T18:45')).toBe('2026-11-04T18:45:00+08:00');
    expect(toLocalInput(fromLocalInput('2026-11-04T18:45')!)).toBe('2026-11-04T18:45');
  });
  it('rejects bad input', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('2026-13-40T99:00')).toBeNull();
  });
});
