import { describe, expect, it } from 'vitest';
import { ROAD_SEGMENTS } from './route.ts';
import { ribbonGeometry, ribbonSamples } from './roadGeometry.ts';

describe('ribbonGeometry', () => {
  it('has upward normals and the expected vertex count', () => {
    for (const s of ROAD_SEGMENTS) {
      const g = ribbonGeometry(s.from, s.to);
      const nrm = g.getAttribute('normal');
      expect(g.getAttribute('position').count).toBe((ribbonSamples(s.from, s.to) + 1) * 2);
      for (let i = 0; i < nrm.count; i++) expect(nrm.getY(i)).toBeGreaterThan(0.99);
    }
  });
  it('adjacent segments share boundary vertices', () => {
    for (let k = 0; k < ROAD_SEGMENTS.length - 1; k++) {
      const a = ribbonGeometry(ROAD_SEGMENTS[k]!.from, ROAD_SEGMENTS[k]!.to).getAttribute('position');
      const b = ribbonGeometry(ROAD_SEGMENTS[k + 1]!.from, ROAD_SEGMENTS[k + 1]!.to).getAttribute('position');
      for (const o of [0, 1]) {
        const ia = a.count - 2 + o;
        expect(a.getX(ia)).toBeCloseTo(b.getX(o), 4);
        expect(a.getZ(ia)).toBeCloseTo(b.getZ(o), 4);
      }
    }
  });
  it('has no folded quads (edges never run backwards)', () => {
    for (const s of ROAD_SEGMENTS) {
      const p = ribbonGeometry(s.from, s.to).getAttribute('position');
      for (let i = 0; i + 3 < p.count; i += 2) {
        for (const o of [0, 1]) {
          const dx = p.getX(i + 2 + o) - p.getX(i + o), dz = p.getZ(i + 2 + o) - p.getZ(i + o);
          const cx = p.getX(i + 2) + p.getX(i + 3) - p.getX(i) - p.getX(i + 1);
          const cz = p.getZ(i + 2) + p.getZ(i + 3) - p.getZ(i) - p.getZ(i + 1);
          expect(dx * cx + dz * cz).toBeGreaterThan(0);
        }
      }
    }
  });
});
