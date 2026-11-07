import { beforeAll, describe, expect, it } from 'vitest';
import { computeOccupancy } from './occupancy.ts';
import { computeDemand } from '../demand.ts';
import { computeRoad } from '../road.ts';
import type { QueueResult } from '../queues.ts';
import { zeros } from '../grid.ts';
import { normalWednesday } from '../../fixtures/engine/index.ts';
import { makeBundle } from '../../fixtures/engine/testkit.ts';
import type { InputBundle, LeverSet, SessionGroup } from '../types.ts';

let base: InputBundle;
beforeAll(async () => { base = await normalWednesday(); });

const g: SessionGroup = { block: 'A', roomType: 'classroom', startMin: 510, endMin: 630, count: 10, firstOfDayShare: 1, lastOfDayShare: 0.5 };

function queuesWith(indoor: Record<number, number>): QueueResult {
  const stop = () => ({ queue: zeros(), arrivals: zeros(), served: zeros(), gaveUp: zeros(), waitMin: zeros(), status: [] });
  const indoorWaiting = zeros();
  for (const [t, v] of Object.entries(indoor)) indoorWaiting[Number(t)] = v;
  return {
    apu: stop(), lrt: stop(), departuresApuToLrt: zeros(), departuresLrtToApu: zeros(),
    stayers: zeros(), newStayers: zeros(), leftBehind: 0, indoorWaiting,
    labels: new Array(76).fill('baseline'), inputs: ['shuttle', 'baseline:busSeats'], warnings: [],
  } as unknown as QueueResult;
}

function run(indoor: Record<number, number>, levers: LeverSet = [], b?: InputBundle) {
  const bundle = b ?? makeBundle(base, { groups: [g], roadRatio: 1 });
  const demand = computeDemand(bundle, levers, computeRoad(bundle));
  return computeOccupancy(bundle, levers, demand, queuesWith(indoor));
}

describe('computeOccupancy', () => {
  it('classroom occupancy from in-class students only', () => {
    const r = run({});
    expect(r.perBlock.A.values[6]).toBeCloseTo(63.75, 8);
    expect(r.perBlock.A.status.every(s => s === 'ok')).toBe(true);
    expect(r.perBlock.A.values[0]).toBe(0);
  });
  it('indoor waiters push occupancy into red', () => {
    const r = run({ 6: 150 });
    expect(r.perBlock.A.values[6]).toBeCloseTo(101.25, 8);
    expect(r.indoorByBlock.A[6]).toBe(150);
    expect(r.campus.values[6]).toBeCloseTo(101.25, 8);
    expect(r.campus.inputs).toContain('baseline:stopOutdoorCapacity');
  });
  it('a waiting hall absorbs the indoor waiters', () => {
    const r = run({ 6: 150 }, [{ kind: 'waitingHall', hallId: 'main-hall', fromMin: 420, toMin: 1560 }]);
    expect(r.perBlock.A.values[6]).toBeCloseTo(63.75, 8);
    expect(r.hallOccupants[6]).toBe(150);
    expect(r.campus.inputs).toContain('hall:main-hall');
  });
  it('with no rooms in use, waiters go to the kept-open block', () => {
    const r = run({ 60: 100 });
    expect(r.keptOpenRooms.B[60]).toBe(3);
    expect(r.perBlock.B.values[60]).toBeCloseTo(83.33, 1);
    expect(r.campus.inputs).toContain('baseline:keptOpenBlock');
  });
  it('a null timetable gives not_enough_data everywhere', () => {
    const b = makeBundle(base, { groups: [g], roadRatio: 1 });
    b.timetable = null;
    const r = run({}, [], b);
    expect(r.campus.status.every(s => s === 'not_enough_data')).toBe(true);
    expect(r.campus.values.every(v => v === null)).toBe(true);
    expect(r.perBlock.A.status.every(s => s === 'not_enough_data')).toBe(true);
  });
  it('labels come from the weakest input', () => {
    const r = run({ 6: 150 });
    expect(r.perBlock.A.labels[6]).not.toBeNull();
  });
});
