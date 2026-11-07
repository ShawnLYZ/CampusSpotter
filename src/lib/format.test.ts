import { describe, expect, it } from 'vitest';
import { formatMetric, pressureText, stampText } from './format.ts';
import type { StepValue } from '@engine/index.ts';

const sv = (value: number | null, status: StepValue['status'] = 'ok'): StepValue => ({ value, status, pressure: null, provenance: null });

describe('formatMetric', () => {
  it('formats each metric', () => {
    expect(formatMetric('buildingEnergy', sv(8.2))).toBe('+8% vs normal');
    expect(formatMetric('buildingEnergy', sv(-3.1))).toBe('−3% vs normal');
    expect(formatMetric('classroomOccupancy', sv(64.2))).toBe('64%');
    expect(formatMetric('walkwayTraffic', sv(78))).toBe('78%');
    expect(formatMetric('cafeteriaQueue', sv(12))).toBe('12 min');
    expect(formatMetric('apuStopQueue', sv(80))).toBe('1 h 20 min');
    expect(formatMetric('shuttleRtt', sv(18))).toBe('18 min');
    expect(formatMetric('roadDelay', sv(1.34))).toBe('1.3×');
    expect(formatMetric('lrtCrowding', sv(1))).toBe('1.0×');
  });
  it('handles missing statuses first', () => {
    expect(formatMetric('apuStopQueue', sv(null, 'no_service'))).toBe('No service');
    expect(formatMetric('lrtStopQueue', sv(null, 'not_enough_data'))).toBe('Not enough data');
  });
  it('pressureText', () => {
    expect(pressureText('green')).toBe('Normal');
    expect(pressureText('amber')).toBe('Busy');
    expect(pressureText('red')).toBe('Overloaded');
  });
});

describe('stampText', () => {
  it('formats an instant as a Malaysia date and 12-hour time', () => {
    expect(stampText('2026-11-05T12:00:00+08:00')).toBe('Thu, 5 Nov 2026, 12:00 PM');
    expect(stampText('2026-11-05T13:33:59.582Z')).toBe('Thu, 5 Nov 2026, 9:33 PM');
  });
  it('returns unparsable input unchanged', () => {
    expect(stampText('not a date')).toBe('not a date');
  });
});
