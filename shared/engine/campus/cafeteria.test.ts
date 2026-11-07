import { beforeAll, describe, expect, it } from 'vitest';
import { computeCafeteria } from './cafeteria.ts';
import { computeDemand } from '../demand.ts';
import { computeRoad } from '../road.ts';
import type { QueueResult } from '../queues.ts';
import { zeros } from '../grid.ts';
import { normalWednesday } from '../../fixtures/engine/index.ts';
import { makeBundle } from '../../fixtures/engine/testkit.ts';
import type { DayType, InputBundle, LeverSet, SessionGroup } from '../types.ts';

let base: InputBundle;
beforeAll(async () => { base = await normalWednesday(); });

const grp = (count: number, startMin = 600, endMin = 720): SessionGroup =>
  ({ block: 'A', roomType: 'classroom', startMin, endMin, count, firstOfDayShare: 0, lastOfDayShare: 0 });

function queues(): QueueResult {
  return {
    stayers: zeros(), newStayers: zeros(), indoorWaiting: zeros(),
    labels: new Array(76).fill('baseline'), inputs: [], warnings: [],
  } as unknown as QueueResult;
}

function run(count: number, levers: LeverSet = [], opts: { zuhrMin?: number; dayType?: DayType } = {}, q = queues()) {
  const b = makeBundle(base, { groups: [grp(count)], roadRatio: 1, ...opts });
  const d = computeDemand(b, levers, computeRoad(b));
  return computeCafeteria(b, levers, d, q);
}

describe('computeCafeteria', () => {
  it('lunch arrivals spread over steps 21-26', () => {
    const r = run(10);
    for (let t = 21; t <= 26; t++) expect(r.arrivals[t]).toBeCloseTo(10.625, 8);
    expect(r.arrivals[20]).toBe(0);
    expect(r.arrivals[27]).toBe(0);
    expect(r.wait.inputs).toContain('cafeteria:main');
    expect(r.wait.inputs).toContain('baseline:eatOnCampusShare');
  });
  it('closed before opening and after closing', () => {
    const r = run(10);
    expect(r.wait.status[0]).toBe('no_service');
    expect(r.wait.status[1]).toBe('no_service');
    expect(r.wait.values[0]).toBeNull();
    expect(r.wait.status[52]).toBe('no_service');
    expect(r.wait.status[24]).toBe('ok');
  });
  it('a closing-time lever keeps it open', () => {
    const r = run(10, [{ kind: 'cafeteria', outletId: 'main', extraCounters: 0, fromMin: 1080, toMin: 1320, closeAtMin: 1320 }]);
    expect(r.wait.status[52]).toBe('ok');
    expect(r.wait.status[60]).toBe('no_service');
  });
  it('wait grows with count; extra counters lower it', () => {
    const r = run(200);
    expect(r.wait.values[26]).toBeCloseTo(87.1, 1);
    const r2 = run(200, [{ kind: 'cafeteria', outletId: 'main', extraCounters: 2, fromMin: 735, toMin: 855, closeAtMin: null }]);
    expect(r2.wait.values[26] as number).toBeLessThan(87.1);
  });
  it('Friday: before-prayer lunch and return peak, nothing in between', () => {
    const r = run(10, [], { zuhrMin: 780, dayType: 'friday' });
    expect(r.arrivals[21]).toBeGreaterThan(0);
    expect(r.arrivals[22]).toBeGreaterThan(0);
    expect(r.arrivals[28]).toBeGreaterThan(0);
    expect(r.arrivals[29]).toBeGreaterThan(0);
    for (let t = 24; t <= 27; t++) expect(r.arrivals[t]).toBe(0);
  });
  it('dinner stayers arrive and add the stay-share input', () => {
    const q = queues();
    q.newStayers[44] = 40; q.stayers[44] = 40;
    const r = run(10, [], {}, q);
    // M1: the 6 pm newcomers arrive once (40 × 0.5); none of them are spread again.
    expect(r.arrivals[44]).toBeCloseTo(20, 8);
    expect(r.arrivals[45]).toBe(0);
    expect(r.wait.inputs).toContain('baseline:defaultStayShare');
  });
  it('M1: only stayers from before 6 pm are spread over 6:00-7:00 pm', () => {
    const q = queues();
    q.newStayers[44] = 40; q.stayers[44] = 60;
    const r = run(10, [], {}, q);
    expect(r.arrivals[44]).toBeCloseTo(20 + 20 * 0.5 / 4, 8);
    for (const t of [45, 46, 47]) expect(r.arrivals[t]).toBeCloseTo(2.5, 8);
    expect(r.arrivals[48]).toBe(0);
  });
  it('null timetable gives not_enough_data at every step', () => {
    const b = makeBundle(base, { groups: [grp(10)], roadRatio: 1 });
    b.timetable = null;
    const d = computeDemand(b, [], computeRoad(b));
    const r = computeCafeteria(b, [], d, queues());
    expect(r.wait.status.every(s => s === 'not_enough_data')).toBe(true);
    expect(r.wait.values.every(v => v === null)).toBe(true);
  });
});
