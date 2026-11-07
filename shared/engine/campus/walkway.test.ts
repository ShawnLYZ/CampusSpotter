import { beforeAll, describe, expect, it } from 'vitest';
import { computeWalkway } from './walkway.ts';
import type { Demand } from '../demand.ts';
import type { QueueResult } from '../queues.ts';
import type { CafeteriaResult } from './cafeteria.ts';
import { zeros } from '../grid.ts';
import { normalWednesday } from '../../fixtures/engine/index.ts';
import type { InputBundle } from '../types.ts';

let base: InputBundle;
beforeAll(async () => { base = await normalWednesday(); });

const queues = (apuArr: number[]) => ({
  apu: { arrivals: apuArr }, labels: new Array(76).fill('baseline'), inputs: ['shuttle'],
}) as unknown as QueueResult;
const caf = { arrivals: zeros() } as unknown as CafeteriaResult;
const demandOf = (over: Partial<Demand>) => ({
  missing: false, endersSpread: zeros(), startersSpread: zeros(), prayerOut: zeros(), prayerBack: zeros(),
  label: 'baseline', inputs: ['timetable'], ...over,
}) as unknown as Demand;

describe('computeWalkway', () => {
  it('flow and percent of capacity', () => {
    const e = zeros(); e[14] = 127.5;
    const a = zeros(); a[14] = 18.965625;
    const r = computeWalkway(base, demandOf({ endersSpread: e }), queues(a), caf);
    expect(r.flowPerMin[14]).toBeCloseTo(9.7644, 3);
    expect(r.series.values[14]).toBeCloseTo(6.5096, 3);
    expect(r.series.status[14]).toBe('ok');
    expect(r.series.inputs).toContain('baseline:walkwayCapacityPerMin');
    expect(r.series.labels[14]).not.toBeNull();
  });
  it('M4: cafeteria inputs and label join where cafeteria arrivals > 0', () => {
    const arrivals = zeros(); arrivals[24] = 30;
    const labels = new Array(76).fill('ai');
    const cafe = { arrivals, wait: { values: [], status: [], labels, inputs: ['cafeteria:main', 'baseline:eatOnCampusShare'] } } as unknown as CafeteriaResult;
    const r = computeWalkway(base, demandOf({}), queues(zeros()), cafe);
    expect(r.series.inputs).toEqual(expect.arrayContaining(['cafeteria:main', 'baseline:eatOnCampusShare']));
    expect(r.series.labels[24]).toBe('ai');
    expect(r.series.labels[23]).not.toBe('ai');
    const none = computeWalkway(base, demandOf({}), queues(zeros()), { ...cafe, arrivals: zeros() } as CafeteriaResult);
    expect(none.series.inputs).not.toContain('cafeteria:main');
  });
  it('missing demand gives not_enough_data', () => {
    const r = computeWalkway(base, demandOf({ missing: true }), queues(zeros()), caf);
    expect(r.series.values.every(v => v === null)).toBe(true);
    expect(r.series.status.every(s => s === 'not_enough_data')).toBe(true);
  });
});
