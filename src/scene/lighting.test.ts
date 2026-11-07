import { describe, expect, it } from 'vitest';
import { lightingAt } from './lighting.ts';

describe('lightingAt', () => {
  it('starts the day at 07:00 with sun intensity 1.2', () => {
    expect(lightingAt(0).sunIntensity).toBe(1.2);
  });
  it('peaks at 12:00 with 1.6', () => {
    expect(lightingAt(20).sunIntensity).toBeCloseTo(1.6, 10);
  });
  it('is 0.9 at 18:00 and not yet night', () => {
    const l = lightingAt(44);
    expect(l.sunIntensity).toBeCloseTo(0.9, 10);
    expect(l.night).toBe(false);
  });
  it('is night from 19:30', () => {
    expect(lightingAt(50).night).toBe(true);
  });
  it('dims ambient to between 0.25 and 0.3 at the last step', () => {
    const { ambient } = lightingAt(75);
    expect(ambient).toBeGreaterThanOrEqual(0.25);
    expect(ambient).toBeLessThanOrEqual(0.3);
  });
});
