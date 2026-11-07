import { beforeAll, describe, expect, it } from 'vitest';
import { priceLevers, tariffSen } from './costs.ts';
import { sessionsMovedBySlot } from './demand.ts';
import type { CostLedger } from './costs.ts';
import { normalWednesday } from '../fixtures/engine/index.ts';
import { makeBundle } from '../fixtures/engine/testkit.ts';
import type { BlockId, InputBundle, Lever } from './types.ts';
import { BLOCK_IDS } from './types.ts';

let base: InputBundle;
beforeAll(async () => { base = await normalWednesday(); });

const blocks = (): Record<BlockId, number[]> =>
  Object.fromEntries(BLOCK_IDS.map(b => [b, Array(76).fill(0)])) as Record<BlockId, number[]>;
const ledger = (over: Partial<CostLedger> = {}): CostLedger => ({
  hallKwh: Array(76).fill(0), acSavedKwh: Array(76).fill(0), precoolKwh: Array(76).fill(0),
  hallKwhByHall: {}, acSavedByBlock: blocks(), precoolByBlock: blocks(),
  sessionsMoved: 0, sessionsScheduled: 0, ...over,
});
const stepOf = (min: number) => (min - 420) / 15;
const fill = (arr: number[], from: number, to: number, v: number) => {
  for (let m = from; m < to; m += 15) arr[stepOf(m)] = v;
  return arr;
};

describe('tariffSen', () => {
  it('uses peak only weekday/friday in [peakFrom, peakTo)', () => {
    const s = base.settings;
    expect(tariffSen(839, 'weekday', s)).toBe(27.23);
    expect(tariffSen(840, 'weekday', s)).toBe(31.32);
    expect(tariffSen(1500, 'weekday', s)).toBe(27.23);
    expect(tariffSen(1320, 'weekday', s)).toBe(27.23);
    expect(tariffSen(900, 'friday', s)).toBe(31.32);
    expect(tariffSen(900, 'weekend', s)).toBe(27.23);
  });
});

describe('priceLevers', () => {
  const price = (levers: Lever[], l = ledger(), b = base) => priceLevers(levers, b, l);

  it('prices extra buses by duration', () => {
    const [a] = price([{ kind: 'extraBuses', buses: 2, fromMin: 600, toMin: 840 }]);
    expect(a.rm).toBe(1300);
    expect(a.text).toBe('2 × 44-seat bus, half day @ RM 650, 10:00 AM–2:00 PM');
    expect(price([{ kind: 'extraBuses', buses: 1, fromMin: 600, toMin: 870 }])[0].rm).toBe(950);
    const [c] = price([{ kind: 'extraBuses', buses: 1, fromMin: 600, toMin: 1140 }]);
    expect(c.rm).toBe(1600);
    expect(c.text).toContain('full day + half day');
  });

  it('prices cafeteria counters and extended close', () => {
    const lines = price([{ kind: 'cafeteria', outletId: 'main', extraCounters: 1, fromMin: 825, toMin: 870, closeAtMin: null }]);
    expect(lines).toHaveLength(1);
    expect(lines[0].rm).toBe(15);
    expect(lines[0].text).toBe('1 extra counter × 2 staff × 0.75 h @ RM 10/h');
    const l2 = price([{ kind: 'cafeteria', outletId: 'main', extraCounters: 1, fromMin: 825, toMin: 870, closeAtMin: 1320 }]);
    expect(l2).toHaveLength(2);
    expect(l2[1].rm).toBe(120);
    expect(l2[1].text).toBe('Main Cafeteria (Centre Point & Atrium, assumed) open until 10:00 PM: 6 staff × 2 h @ RM 10/h');
    expect(price([{ kind: 'cafeteria', outletId: 'main', extraCounters: 0, fromMin: 825, toMin: 870, closeAtMin: 1320 }])).toHaveLength(1);
  });

  it('prices waiting halls with time-of-use tariff', () => {
    const hall = (from: number, to: number): Lever => ({ kind: 'waitingHall', hallId: 'main-hall', fromMin: from, toMin: to });
    const l1 = ledger({ hallKwhByHall: { 'main-hall': fill(Array(76).fill(0), 1020, 1320, 7.5) } });
    const [a] = price([hall(1020, 1320)], l1);
    expect(a.rm).toBeCloseTo(46.98, 2);
    expect(a.text).toBe('Main Hall, Block B (assumed) open 5:00 PM–10:00 PM: 150 kWh @ TNB time-of-use');
    const l2 = ledger({ hallKwhByHall: { 'main-hall': fill(Array(76).fill(0), 780, 900, 7.5) } });
    expect(price([hall(780, 900)], l2)[0].rm).toBeCloseTo(17.565, 2);
    const wk = makeBundle(base, { dayType: 'weekend' });
    expect(price([hall(780, 900)], l2, wk)[0].rm).toBeCloseTo(16.338, 2);
  });

  it('prices AC off as negative cost', () => {
    const ac = blocks(); fill(ac.A, 600, 720, 84 / 8);
    const l = ledger({ acSavedByBlock: ac });
    const [a] = price([{ kind: 'acOffInGap', fromMin: 600, toMin: 720, blocks: 'all' }], l);
    expect(a.rm).toBe(-22.87);
    expect(a.text).toBe('AC and lights off in empty rooms, 10:00 AM–12:00 PM: saves 84 kWh');
  });

  it('nets precool against savings', () => {
    const ac = blocks(); fill(ac.A, 600, 720, 10);
    const pc = blocks(); fill(pc.A, 600, 720, 5);
    const l = ledger({ acSavedByBlock: ac, precoolByBlock: pc });
    const [a] = price([{ kind: 'acOffInGap', fromMin: 600, toMin: 720, blocks: 'all' }], l);
    expect(a.text).toContain('saves 40 kWh');
    expect(a.rm).toBe(-10.89);
  });

  it('F1: two hall windows on the same hall sum to the single-window cost', () => {
    const hall = (from: number, to: number): Lever => ({ kind: 'waitingHall', hallId: 'main-hall', fromMin: from, toMin: to });
    // The ledger holds the hall kWh produced by both windows together (17:00-22:00).
    const l = ledger({ hallKwhByHall: { 'main-hall': fill(Array(76).fill(0), 1020, 1320, 7.5) } });
    const [a, b] = price([hall(1020, 1140), hall(1140, 1320)], l);
    expect(a.text).toBe('Main Hall, Block B (assumed) open 5:00 PM–7:00 PM: 60 kWh @ TNB time-of-use');
    expect(b.text).toBe('Main Hall, Block B (assumed) open 7:00 PM–10:00 PM: 90 kWh @ TNB time-of-use');
    expect(a.rm + b.rm).toBeCloseTo(46.98, 2);
  });

  it('F1: a hall lever is charged only its own hall', () => {
    const l = ledger({ hallKwhByHall: { 'other-hall': fill(Array(76).fill(0), 1020, 1320, 7.5) } });
    const [a] = price([{ kind: 'waitingHall', hallId: 'main-hall', fromMin: 1020, toMin: 1320 }], l);
    expect(a.rm).toBe(0);
  });

  it('F1: two AC-off windows sum to the single-window total', () => {
    const ac = blocks(); fill(ac.A, 600, 720, 84 / 8); fill(ac.B, 600, 720, 4);
    const l = ledger({ acSavedByBlock: ac });
    const [whole] = price([{ kind: 'acOffInGap', fromMin: 600, toMin: 720, blocks: 'all' }], l);
    const [p1, p2] = price([
      { kind: 'acOffInGap', fromMin: 600, toMin: 660, blocks: 'all' },
      { kind: 'acOffInGap', fromMin: 660, toMin: 720, blocks: 'all' },
    ], l);
    // Each line is rounded to the sen, so the split may differ by one sen.
    expect(Math.abs(p1.rm + p2.rm - whole.rm)).toBeLessThanOrEqual(0.011);
    expect(p1.text).toContain('saves 58 kWh');
    // A lever on block B only is charged only block B.
    const [onlyB] = price([{ kind: 'acOffInGap', fromMin: 600, toMin: 720, blocks: ['B'] }], l);
    expect(onlyB.text).toContain('saves 32 kWh');
  });

  it('F1: classesOnline text uses the lever own moved count', () => {
    const lines = price([
      { kind: 'classesOnline', fromMin: 645, toMin: 900, blocks: 'all' },
      { kind: 'classesOnline', fromMin: 645, toMin: 900, blocks: ['A'] },
    ], ledger({ sessionsMoved: 413, sessionsScheduled: 554 }));
    const nA = sessionsMovedBySlot(base, { kind: 'classesOnline', fromMin: 645, toMin: 900, blocks: ['A'] })
      .reduce((a, s) => a + s.count, 0);
    expect(nA).toBeGreaterThan(0);
    expect(nA).toBeLessThan(413);
    expect(lines[1].text).toBe(`Classes online from 10:45 AM: ${nA} sessions (no cost; learning disruption ${Math.round(100 * nA / 554)}%)`);
  });

  it('zero-cost levers', () => {
    const lines = price([
      { kind: 'nonstopLoop', fromMin: 600, toMin: 720 },
      { kind: 'busesAtLrt', buses: 1, atMin: 1080 },
      { kind: 'busesAtLrt', buses: 2, atMin: 1080 },
      { kind: 'classesOnline', fromMin: 645, toMin: 900, blocks: 'all' },
      { kind: 'stagger', target: 'end', fromMin: 600, toMin: 720, shifts: {} },
      { kind: 'advisory', advisedMin: 1020, message: 'leave_before' },
      { kind: 'advisory', advisedMin: 1020, message: 'walk_to_lrt' },
      { kind: 'advisory', advisedMin: 1020, message: 'expect_delays' },
      { kind: 'studentCount', percent: 80 },
    ], ledger({ sessionsMoved: 413, sessionsScheduled: 554 }));
    expect(lines).toHaveLength(8);
    expect(lines.every((x) => x.rm === 0 && !Object.is(x.rm, -0))).toBe(true);
    expect(lines[0].text).toBe('Nonstop loop, 10:00 AM–12:00 PM (existing fleet)');
    expect(lines[1].text).toBe('1 bus waiting at LRT Bukit Jalil from 6:00 PM (existing fleet)');
    expect(lines[2].text).toBe('2 buses waiting at LRT Bukit Jalil from 6:00 PM (existing fleet)');
    // The lever's own moved count on normalWednesday (294 of the ledger's 554 scheduled).
    expect(lines[3].text).toBe('Classes online from 10:45 AM: 294 sessions (no cost; learning disruption 53%)');
    expect(lines[4].text).toBe('Stagger end times by block, 10:00 AM–12:00 PM (no cost)');
    expect(lines[5].text).toBe('Student advisory: leave before 5:00 PM (no cost)');
    expect(lines[6].text).toBe('Student advisory: walk to LRT after 5:00 PM (no cost)');
    expect(lines[7].text).toBe('Student advisory: expect delays after 5:00 PM (no cost)');
  });
});
