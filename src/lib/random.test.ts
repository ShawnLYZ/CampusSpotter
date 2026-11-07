import { describe, expect, it } from 'vitest';
import { seededRandom } from './random.ts';

describe('seededRandom', () => {
  it('is deterministic for a seed and returns values in [0,1)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    for (const v of first) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
