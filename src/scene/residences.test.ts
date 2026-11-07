import { describe, expect, it } from 'vitest';
import { itemById } from './layout.ts';
import { residencePairBoxes } from './parts/Residences.tsx';

describe('residencePairBoxes', () => {
  it('wraps both slabs of each tower pair (two 6-wide slabs at ±2.5 span 11)', () => {
    const boxes = residencePairBoxes();
    expect(boxes).toHaveLength(2);
    for (const [i, id] of (['residences-j', 'residences-k'] as const).entries()) {
      const it = itemById(id)!;
      expect(boxes[i]).toMatchObject({ x: it.x, z: it.z, w: 11, d: it.d, h: 12 * 0.7 });
    }
  });
});
