import { describe, expect, it } from 'vitest';
import { FLOOR_HEIGHT, itemById } from './layout.ts';
import { residenceBoxes } from './parts/Residences.tsx';

describe('residenceBoxes', () => {
  it('wraps each residence tower from the ground to its roof', () => {
    const boxes = residenceBoxes();
    expect(boxes).toHaveLength(2);
    for (const [i, id] of (['residences-j', 'residences-k'] as const).entries()) {
      const it = itemById(id)!;
      expect(boxes[i]).toMatchObject({ x: it.x, y: 0, z: it.z, w: it.w, d: it.d, h: it.floors! * FLOOR_HEIGHT });
    }
  });
});
