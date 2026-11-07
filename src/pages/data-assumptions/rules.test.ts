import { describe, expect, it } from 'vitest';
import { riskRuleLines, t0Note, thresholdBands } from './rules.ts';

describe('thresholdBands', () => {
  it('percent metrics', () => {
    expect(thresholdBands('percent', { amberFrom: 85, redAbove: 100, greenInclusive: false }))
      .toEqual({ green: '< 85%', amber: '85–100%', red: '> 100%' });
  });
  it('energy uses +N% and greenInclusive', () => {
    const b = thresholdBands('percent_vs_normal', { amberFrom: 10, redAbove: 25, greenInclusive: true });
    expect(b.green).toBe('≤ +10%');
    expect(b.red).toBe('> +25%');
  });
  it('minutes and ratio', () => {
    expect(thresholdBands('minutes', { amberFrom: 15, redAbove: 45, greenInclusive: false }).amber).toBe('15–45 min');
    expect(thresholdBands('ratio', { amberFrom: 1.3, redAbove: 2, greenInclusive: false }).green).toBe('< 1.3×');
  });
});

describe('risk and T0 text', () => {
  it('fills in configured values', () => {
    const l = riskRuleLines({ criticalRedMin: 120, criticalApuWaitMin: 90, criticalLeftBehind: 100, highRedMin: 30, mediumAmberMin: 60 });
    expect(l.map((x) => x.level)).toEqual(['Critical', 'High', 'Medium', 'Low']);
    expect(l[0].text).toContain('≥ 120 minutes');
    expect(l[0].text).toContain('> 90 min');
  });
  it('T0 note uses the Google value', () => {
    expect(t0Note(9.07)).toBe('T0 = 6 min Baseline (OSRM); Google free-flow 9.07 min shown for comparison (D7)');
  });
});
