import { describe, expect, it } from 'vitest';
import { CAMPUS_LAYOUT, SITE, SPINE_DECK, facadeCovered, itemById } from './layout.ts';

describe('facadeCovered', () => {
  const b = itemById('block-b')!;
  it('is true behind a sun screen and behind a core', () => {
    expect(facadeCovered(b, 's', 0.5)).toBe(true);
    expect(facadeCovered(b, 's', 0.05)).toBe(true);
  });
  it('is false on open wall and on a side with neither', () => {
    expect(facadeCovered(b, 's', 0.95)).toBe(false);
    expect(facadeCovered(b, 'n', 0.5)).toBe(false);
  });
});

describe('CAMPUS_LAYOUT', () => {
  it('has unique ids', () => {
    const ids = CAMPUS_LAYOUT.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('keeps every building on the site', () => {
    for (const i of CAMPUS_LAYOUT) {
      if (!i.w || !i.d) continue;
      expect(i.x - i.w / 2, i.id).toBeGreaterThanOrEqual(SITE.x0);
      expect(i.x + i.w / 2, i.id).toBeLessThanOrEqual(SITE.x1);
      expect(i.z - i.d / 2, i.id).toBeGreaterThanOrEqual(SITE.z0);
      expect(i.z + i.d / 2, i.id).toBeLessThanOrEqual(SITE.z1);
    }
  });
  it('runs the Spine deck along the podium roof, inside the spine item', () => {
    const spine = itemById('spine')!, podium = itemById('podium')!;
    expect(SPINE_DECK.x0).toBeGreaterThanOrEqual(spine.x - spine.w! / 2);
    expect(SPINE_DECK.x1).toBeLessThanOrEqual(spine.x + spine.w! / 2);
    expect(Math.abs(SPINE_DECK.z - podium.z)).toBeLessThanOrEqual(podium.d! / 2);
  });
});
