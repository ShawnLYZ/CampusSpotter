import { describe, it, expect } from 'vitest';
import { fixtureTables } from './index.ts';
import type { ShuttleRow } from '../../bundle/rows.ts';

const rows = fixtureTables.shuttle_timetable as ShuttleRow[];
const normal = rows.filter((r) => r.service === 'normal');
const reduced = rows.filter((r) => r.service === 'reduced');
const mins = (r: ShuttleRow[]) => r.map((x) => x.departure_min);

describe('shuttle timetable fixtures', () => {
  it('has 39 lrt_to_apu and 39 apu_to_lrt normal departures, plus one loop', () => {
    expect(normal.filter((r) => r.direction === 'lrt_to_apu')).toHaveLength(39);
    expect(normal.filter((r) => r.direction === 'apu_to_lrt')).toHaveLength(39);
    const loops = normal.filter((r) => r.direction === 'loop');
    expect(loops).toHaveLength(1);
    expect([loops[0].departure_min, loops[0].loop_to_min]).toEqual([450, 525]);
  });
  it('marks only the 20:45 and 21:45 apu_to_lrt runs as limited seats', () => {
    const limited = normal.filter((r) => r.limited_seats);
    expect(mins(limited.filter((r) => r.direction === 'apu_to_lrt'))).toEqual([1245, 1305]);
    expect(limited).toHaveLength(2);
  });
  it('has the expected first and last departures', () => {
    const apu = normal.filter((r) => r.direction === 'apu_to_lrt');
    const lrt = normal.filter((r) => r.direction === 'lrt_to_apu');
    expect(apu[0].departure_min).toBe(635);
    expect(lrt[lrt.length - 1].departure_min).toBe(1100);
  });
  it('has 10 lrt_to_apu and 9 apu_to_lrt reduced departures', () => {
    expect(reduced.filter((r) => r.direction === 'lrt_to_apu')).toHaveLength(10);
    expect(reduced.filter((r) => r.direction === 'apu_to_lrt')).toHaveLength(9);
    expect(reduced.some((r) => r.direction === 'loop')).toBe(false);
  });
  it('has integer departure minutes within the grid range', () => {
    for (const r of rows) {
      expect(Number.isInteger(r.departure_min)).toBe(true);
      expect(r.departure_min).toBeGreaterThanOrEqual(420);
      expect(r.departure_min).toBeLessThanOrEqual(1560);
    }
  });
  it('labels and sources normal rows as baseline, with verified exceptions', () => {
    const verified = (r: ShuttleRow) => r.direction === 'loop' || (r.direction === 'apu_to_lrt' && r.limited_seats);
    for (const r of normal) {
      expect(r.effective_from).toBe('2025-05-02');
      if (verified(r)) expect(r, `${r.direction} ${r.departure_min}`).toMatchObject({ label: 'verified', source_id: 'apspace-2026-10-22' });
      else expect(r, `${r.direction} ${r.departure_min}`).toMatchObject({ label: 'baseline', source_id: 'apu-shuttle-2025-05' });
    }
    expect(normal.filter((r) => r.label === 'verified')).toHaveLength(3);
  });
  it('labels reduced rows as baseline from the CNY 2026 source', () => {
    for (const r of reduced) {
      expect(r).toMatchObject({ label: 'baseline', source_id: 'apu-shuttle-cny-2026', effective_from: '2026-02-20', limited_seats: false, loop_to_min: null });
    }
  });
  it('sets loop_to_min to null for non-loop rows', () => {
    for (const r of rows.filter((x) => x.direction !== 'loop')) expect(r.loop_to_min).toBeNull();
  });
});
