import { describe, it, expect } from 'vitest';
import { clock12, durationText, ratioText, pctText, rmText, dateText } from './format.ts';
describe('format', () => {
  it('formats 12-hour clock times', () => {
    expect(clock12(645)).toBe('10:45 AM'); expect(clock12(720)).toBe('12:00 PM'); expect(clock12(1095)).toBe('6:15 PM');
    expect(clock12(1440)).toBe('12:00 AM'); expect(clock12(1545)).toBe('1:45 AM');
  });
  it('formats durations', () => {
    expect(durationText(130)).toBe('2 h 10 min'); expect(durationText(45)).toBe('45 min'); expect(durationText(60)).toBe('1 h'); expect(durationText(12.4)).toBe('12 min');
  });
  it('formats ratios, percents and RM', () => {
    expect(ratioText(3.14)).toBe('3.1×'); expect(pctText(112.4)).toBe('112%');
    expect(rmText(1300)).toBe('RM 1,300'); expect(rmText(46.98)).toBe('RM 47'); expect(rmText(-84.2)).toBe('−RM 84'); expect(rmText(1234567)).toBe('RM 1,234,567');
  });
});
describe('dateText', () => {
  it('formats calendar dates', () => {
    expect(dateText('2026-11-04')).toBe('Wed, 4 Nov 2026');
    expect(dateText('2026-12-12')).toBe('Sat, 12 Dec 2026');
  });
});
