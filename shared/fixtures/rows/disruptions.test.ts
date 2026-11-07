import { describe, it, expect } from 'vitest';
import { fixtureTables } from './index.ts';
import type { DisruptionRow, DisruptionSourceRow } from '../../bundle/rows.ts';

const ids = ['weeknd-2026-11-04', 'weeknd-2026-11-05', 'bts-2026-12-12', 'bts-2026-12-13', 'intake-2026-11-12', 'intake-2026-11-19', 'intake-2026-11-24', 'intake-2026-11-26', 'deepavali-2026', 'yearend-break-2026'];

describe('disruption fixtures', () => {
  it('contains exactly the expected ids', () => {
    expect((fixtureTables.disruptions as DisruptionRow[]).map((r) => r.id).sort()).toEqual([...ids].sort());
  });
  it('every disruption has a source', () => {
    const src = fixtureTables.disruption_sources as DisruptionSourceRow[];
    for (const id of ids) expect(src.some((s) => s.disruption_id === id)).toBe(true);
  });
});
