import { beforeAll, describe, expect, it } from 'vitest';
import { computeEnergy, energyPercent } from './energy.ts';
import { computeOccupancy } from './occupancy.ts';
import { computeDemand } from '../demand.ts';
import { computeRoad } from '../road.ts';
import type { QueueResult } from '../queues.ts';
import { zeros } from '../grid.ts';
import { normalWednesday } from '../../fixtures/engine/index.ts';
import { makeBundle } from '../../fixtures/engine/testkit.ts';
import type { InputBundle, LeverSet, RoomCounts, SessionGroup } from '../types.ts';

let base: InputBundle;
beforeAll(async () => { base = await normalWednesday(); });

const queues = {
  apu: {}, lrt: {}, indoorWaiting: zeros(), labels: new Array(76).fill('baseline'), inputs: [],
} as unknown as QueueResult;

const g: SessionGroup = { block: 'A', roomType: 'classroom', startMin: 510, endMin: 630, count: 10, firstOfDayShare: 1, lastOfDayShare: 0.5 };
const g2: SessionGroup = { ...g, startMin: 720, endMin: 840, firstOfDayShare: 0, lastOfDayShare: 0 };
const cond = (from: number, to: number, n: number): RoomCounts[] =>
  Array.from({ length: 76 }, (_, t): RoomCounts => ({ classroom: t >= from && t <= to ? n : 0, lab: 0, auditorium: 0 }));

function run(opts: { groups: SessionGroup[]; conditioned?: RoomCounts[] }, levers: LeverSet = []) {
  const b = makeBundle(base, { groups: opts.groups, roadRatio: 1, conditioned: opts.conditioned ? { A: opts.conditioned } : undefined });
  const d = computeDemand(b, levers, computeRoad(b));
  return computeEnergy(b, levers, d, computeOccupancy(b, levers, d, queues));
}
const c613 = cond(6, 13, 10);

describe('computeEnergy', () => {
  it('base loads only', () => {
    const r = run({ groups: [], conditioned: cond(0, -1, 0) });
    expect(r.kwh[0]).toBe(107.5);
    expect(r.labels[0]).not.toBeNull();
    expect(r.inputs).toContain('energy:A');
    expect(r.inputs).toContain('timetable');
  });
  it('occupied rooms', () => {
    expect(run({ groups: [g], conditioned: c613 }).perBlockKwh.A[6]).toBe(30);
  });
  it('idle rooms when online', () => {
    const r = run({ groups: [g], conditioned: c613 }, [{ kind: 'classesOnline', fromMin: 420, toMin: 1560, blocks: 'all' }]);
    expect(r.perBlockKwh.A[6]).toBe(20);
  });
  it('AC off in gap', () => {
    const r = run({ groups: [g], conditioned: c613 }, [
      { kind: 'classesOnline', fromMin: 420, toMin: 1560, blocks: 'all' },
      { kind: 'acOffInGap', fromMin: 420, toMin: 630, blocks: 'all' },
    ]);
    expect(r.perBlockKwh.A[6]).toBe(15);
    expect(r.acSavedKwh[6]).toBe(5);
  });
  it('pre-cool before the next session', () => {
    const r = run({ groups: [g2], conditioned: cond(6, 21, 10) }, [{ kind: 'acOffInGap', fromMin: 630, toMin: 720, blocks: 'all' }]);
    expect(r.perBlockKwh.A[19]).toBe(30);
    expect(r.precoolKwh[19]).toBe(15);
    expect(r.perBlockKwh.A[18]).toBe(15);
  });
  it('waiting hall adds load to its block', () => {
    const none = run({ groups: [g], conditioned: c613 });
    const hall = run({ groups: [g], conditioned: c613 }, [{ kind: 'waitingHall', hallId: 'main-hall', fromMin: 1020, toMin: 1320 }]);
    expect(hall.perBlockKwh.B[40] - none.perBlockKwh.B[40]).toBeCloseTo(7.5, 8);
    expect(hall.hallKwh[40]).toBeCloseTo(7.5, 8);
    expect(hall.inputs).toContain('hall:main-hall');
    expect(hall.hallKwhByHall['main-hall'][40]).toBeCloseTo(7.5, 8);
    expect(hall.hallKwhByHall['main-hall'][39]).toBe(0);
  });
  it('per-block AC saving and pre-cool arrays', () => {
    const r = run({ groups: [g2], conditioned: cond(6, 21, 10) }, [{ kind: 'acOffInGap', fromMin: 630, toMin: 720, blocks: ['A'] }]);
    expect(r.precoolByBlock.A[19]).toBe(15);
    expect(r.acSavedByBlock.A[18]).toBe(5);
    expect(r.acSavedByBlock.B.every(v => v === 0)).toBe(true);
  });
  it('energyPercent', () => {
    expect(energyPercent(110, 100)).toBeCloseTo(10, 10);
    expect(energyPercent(5, 0)).toBe(0);
  });
});
