import { beforeAll, describe, expect, it } from 'vitest';
import { computeQueues } from './queues.ts';
import type { ShuttlePlan } from './shuttle.ts';
import { STEPS, zeros } from './grid.ts';
import { normalWednesday } from '../fixtures/engine/index.ts';
import { makeBundle } from '../fixtures/engine/testkit.ts';
import type { DisruptionRef, Estimate, InputBundle, LeverSet } from './types.ts';

let base: InputBundle;
let bundle: InputBundle;
beforeAll(async () => {
  base = await normalWednesday();
  bundle = makeBundle(base, { roadRatio: 1, disruptions: [], estimates: [] });
});

const fill = <T>(v: T): T[] => Array.from({ length: STEPS }, () => v);

function mkPlan(over: Partial<ShuttlePlan> = {}, rate = 4.5): ShuttlePlan {
  return {
    rttMin: fill<number | null>(18), fleet: fill(6), ratePerStep: fill<number | null>(rate),
    schedApu: zeros(), schedLrt: zeros(), loop: fill(false), serviceApu: fill(true), serviceLrt: fill(true),
    lastApuStep: null, lastApuMin: null, extraAtLrt: zeros(),
    labels: fill<'baseline' | null>('baseline'), inputs: ['shuttle'], ...over,
  };
}
function arr(entries: Record<number, number>): number[] {
  const a = zeros();
  for (const [k, v] of Object.entries(entries)) a[Number(k)] = v;
  return a;
}
const demand = (apu: number[], lrt: number[] = zeros()) => ({
  apuStopArrivals: apu, lrtStopArrivals: lrt, label: 'baseline' as const, inputs: ['timetable'],
});
const run = (plan: ShuttlePlan, apu: number[], lrt: number[] = zeros(), levers: LeverSet = [], b?: InputBundle) =>
  computeQueues(b ?? bundle, levers, demand(apu, lrt), plan);

describe('computeQueues', () => {
  it('carries fractional bus availability between steps', () => {
    const q = run(mkPlan({ loop: fill(true) }, 0.75), arr({ 0: 1000 }));
    expect(q.departuresApuToLrt.slice(0, 4)).toEqual([0, 1, 1, 1]);
    // Review Focus 2: a step with zero departures (carry not yet ≥ 1 bus) is still 'ok' with a wait.
    expect(q.apu.status[0]).toBe('ok');
    expect(q.apu.waitMin[0]).not.toBeNull();
    expect(q.apu.waitMin[0]).toBeGreaterThan(0);
  });
  it('runs at least the scheduled departures', () => {
    const q = run(mkPlan({ schedApu: arr({ 10: 1 }) }), arr({ 10: 10 }));
    expect(q.departuresApuToLrt[10]).toBe(1);
    expect(q.apu.queue[10]).toBe(0);
    expect(q.apu.served[10]).toBe(10);
    expect(q.apu.waitMin[10]).toBe(0);
    expect(q.apu.status[10]).toBe('ok');
  });
  it('buses leave when full', () => {
    const q = run(mkPlan(), arr({ 10: 100 }));
    expect(q.departuresApuToLrt[10]).toBe(2);
    expect(q.apu.queue[10]).toBe(12);
  });
  it('statuses: no_service and not_enough_data', () => {
    const rtt = fill<number | null>(18); rtt[5] = null;
    const rate = fill<number | null>(4.5); rate[5] = null;
    const sa = fill(true); sa[3] = false;
    const q = run(mkPlan({ rttMin: rtt, ratePerStep: rate, serviceApu: sa }), arr({ 3: 20 }));
    expect(q.apu.status[3]).toBe('no_service');
    expect(q.apu.waitMin[3]).toBeNull();
    expect(q.departuresApuToLrt[3]).toBe(0);
    expect(q.apu.queue[3]).toBe(20);
    expect(q.apu.status[5]).toBe('not_enough_data');
    expect(q.apu.waitMin[5]).toBeNull();
    expect(q.lrt.status[5]).toBe('not_enough_data');
    expect(q.lrt.status[3]).toBe('ok');
  });
  it('give-up: long waits shed riders, some become stayers', () => {
    const q = run(mkPlan({}, 0.5), arr({ 0: 200 }));
    expect(q.departuresApuToLrt[0]).toBe(0);
    expect(q.apu.waitMin[0]).toBeCloseTo(136.36, 1);
    expect(q.apu.gaveUp[0]).toBeCloseTo(10);
    expect(q.apu.queue[0]).toBeCloseTo(190);
    expect(q.newStayers[0]).toBeCloseTo(3);
    expect(q.stayers[0]).toBeCloseTo(3);
  });
  it('stayers rejoin the APU queue at step 54 (20:30)', () => {
    // 1000/3 arrive at step 50 with rate 0.5: no departure, give-up 1000/3 × 0.05 = 16.67, stayers 5.
    const sa = fill(true); for (let t = 0; t < 50; t++) sa[t] = false; sa[51] = sa[52] = sa[53] = false;
    const rtt = fill<number | null>(18); rtt[54] = null;
    const rate = fill<number | null>(0.5); rate[54] = null;
    const q = run(mkPlan({ serviceApu: sa, rttMin: rtt, ratePerStep: rate }, 0.5), arr({ 50: 1000 / 3 }));
    expect(q.stayers[53]).toBeCloseTo(5);
    expect(q.stayers[54]).toBe(0);
    expect(q.apu.queue[54] - q.apu.queue[53]).toBeCloseTo(5);
  });
  it('left behind after the last APU bus', () => {
    const q = run(mkPlan({ lastApuStep: 10, lastApuMin: 570 }, 0.5), arr({ 0: 200, 12: 7 }));
    // step 0: queue 190, stayers 3; steps 1..10 serve/give up; at step 10 remaining queue + stayers leave.
    const qa10 = q.apu.queue[10];
    expect(qa10).toBe(0);
    expect(q.stayers[10]).toBe(0);
    for (let t = 11; t < STEPS; t++) {
      expect(q.apu.status[t]).toBe('no_service');
      expect(q.apu.waitMin[t]).toBeNull();
      expect(q.departuresApuToLrt[t]).toBe(0);
      expect(q.apu.queue[t]).toBe(0);
      expect(q.apu.gaveUp[t]).toBe(0);
    }
    const served = q.apu.served.reduce((a, b) => a + b, 0);
    const gaveUp = q.apu.gaveUp.reduce((a, b) => a + b, 0);
    const stayersLost = q.newStayers.reduce((a, b) => a + b, 0);
    // conservation: arrivals = served + gave-up (non-stayers) + left behind
    expect(served + (gaveUp - stayersLost) + q.leftBehind).toBeCloseTo(207);
    expect(q.leftBehind).toBeGreaterThan(7);
  });
  it('buses at LRT add LRT departures', () => {
    const q = run(mkPlan({ extraAtLrt: arr({ 20: 2 }) }), zeros());
    expect(q.departuresLrtToApu[20]).toBe(2);
    expect(q.departuresLrtToApu[19]).toBe(0);
  });
  it('advisory leave_before moves compliant riders due in the hour after the advised time into the hour before', () => {
    const dis: DisruptionRef = { id: 'c1', type: 'manual', kind: 'concert', title: 'c1', venue: null, startMin: 1080, endMin: 1260, expectedAttendance: null };
    const est: Estimate = { key: 'advisoryCompliance', disruptionId: 'c1', likely: 0.6, low: 0.6, high: 0.6, unit: 'share', reasoning: '', confidence: 'medium', model: 't', createdAt: 't', clamped: false };
    const b = makeBundle(base, { roadRatio: 1, disruptions: [dis], estimates: [est] });
    const sa = fill(false);
    // 12:00 pm is step 20: steps 20–23 move into steps 16–19; step 24 (1:00 pm) and later stay.
    const q = run(mkPlan({ serviceApu: sa }), arr({ 23: 100, 24: 100, 40: 100 }), zeros(),
      [{ kind: 'advisory', advisedMin: 720, message: 'leave_before' }], b);
    expect(q.apu.arrivals[23]).toBeCloseTo(40);
    expect(q.apu.arrivals[24]).toBe(100);
    expect(q.apu.arrivals[40]).toBe(100);
    for (const t of [16, 17, 18, 19]) expect(q.apu.arrivals[t]).toBeCloseTo(15);
    expect(q.apu.arrivals[15]).toBe(0);
    expect(q.inputs).toContain('estimate:advisoryCompliance:c1');
    expect(q.warnings).toEqual([]);
  });
  it('advisory walk_to_lrt and expect_delays', () => {
    const dis: DisruptionRef = { id: 'c1', type: 'manual', kind: 'concert', title: 'c1', venue: null, startMin: 1080, endMin: 1260, expectedAttendance: null };
    const est: Estimate = { key: 'advisoryCompliance', disruptionId: 'c1', likely: 0.5, low: 0.5, high: 0.5, unit: 'share', reasoning: '', confidence: 'medium', model: 't', createdAt: 't', clamped: false };
    const b = makeBundle(base, { roadRatio: 1, disruptions: [dis], estimates: [est] });
    const off = fill(false);
    const q = run(mkPlan({ serviceApu: off, serviceLrt: off }), arr({ 30: 100 }), arr({ 30: 100 }),
      [{ kind: 'advisory', advisedMin: 720, message: 'walk_to_lrt' }, { kind: 'advisory', advisedMin: 720, message: 'expect_delays' }], b);
    expect(q.apu.arrivals[30]).toBeCloseTo(50);
    expect(q.lrt.arrivals[30]).toBeCloseTo(50);
    expect(q.lrt.arrivals[28]).toBeCloseTo(50);
  });
  it('advisory without a compliance estimate warns once per lever and does nothing', () => {
    const q = run(mkPlan({ serviceApu: fill(false) }), arr({ 25: 100 }), zeros(),
      [{ kind: 'advisory', advisedMin: 720, message: 'leave_before' }, { kind: 'advisory', advisedMin: 900, message: 'walk_to_lrt' }]);
    expect(q.apu.arrivals[25]).toBe(100);
    expect(q.warnings.filter(w => w.code === 'estimate_missing')).toHaveLength(2);
  });
  it('indoor waiting counts the queue above outdoor capacity (before the first service, arrivals still queue)', () => {
    const sa = fill(false); sa[20] = true;
    const q = run(mkPlan({ serviceApu: sa }), arr({ 10: 300 }));
    expect(q.apu.queue[10]).toBe(300);
    expect(q.indoorWaiting[10]).toBe(150);
    expect(q.indoorWaiting[9]).toBe(0);
  });
  it('F2: a direction with no service all day does not queue its arrivals', () => {
    const off = fill(false);
    const q = run(mkPlan({ serviceApu: off, serviceLrt: off }), arr({ 10: 300, 40: 50 }), arr({ 12: 80 }));
    expect(q.apu.arrivals[10]).toBe(300);
    expect(q.lrt.arrivals[12]).toBe(80);
    for (const stop of [q.apu, q.lrt]) {
      expect(stop.queue.every(v => v === 0)).toBe(true);
      expect(stop.served.every(v => v === 0)).toBe(true);
      expect(stop.gaveUp.every(v => v === 0)).toBe(true);
      expect(stop.status.every(s => s === 'no_service')).toBe(true);
      expect(stop.waitMin.every(v => v === null)).toBe(true);
    }
    expect(q.indoorWaiting.every(v => v === 0)).toBe(true);
    expect(q.stayers.every(v => v === 0)).toBe(true);
    expect(q.leftBehind).toBe(0);
  });
  it('F3: arrivals during missing road data are not modelled; the queue is frozen; one warning per stop', () => {
    const rtt = fill<number | null>(18); const rate = fill<number | null>(0.5);
    for (let t = 20; t <= 23; t++) { rtt[t] = null; rate[t] = null; }
    const q = run(mkPlan({ rttMin: rtt, ratePerStep: rate, lastApuStep: 25, lastApuMin: 795 }, 0.5),
      arr({ 19: 200, 21: 30.4, 22: 10 }), arr({ 21: 7 }));
    for (let t = 20; t <= 23; t++) {
      expect(q.apu.status[t]).toBe('not_enough_data');
      expect(q.apu.queue[t]).toBe(q.apu.queue[19]);
      expect(q.apu.gaveUp[t]).toBe(0);
      expect(q.newStayers[t]).toBe(0);
    }
    expect(q.apu.arrivals[21]).toBe(30.4);
    // left behind at the last bus uses only the modelled queue (no excluded arrivals)
    const ref = run(mkPlan({ rttMin: rtt, ratePerStep: rate, lastApuStep: 25, lastApuMin: 795 }, 0.5),
      arr({ 19: 200 }), zeros());
    expect(q.leftBehind).toBeCloseTo(ref.leftBehind, 10);
    expect(q.indoorWaiting).toEqual(ref.indoorWaiting);
    const w = q.warnings.filter(x => x.code === 'not_enough_data');
    expect(w).toEqual([
      { code: 'not_enough_data', metric: 'apuStopQueue', message: 'not enough data: 40 students arriving at the APU stop during missing road data are not modelled' },
      { code: 'not_enough_data', metric: 'lrtStopQueue', message: 'not enough data: 7 students arriving at the LRT stop during missing road data are not modelled' },
    ]);
    expect(run(mkPlan({ rttMin: rtt, ratePerStep: rate }), arr({ 19: 20 })).warnings).toEqual([]);
  });
  it('labels, inputs and array lengths', () => {
    const q = run(mkPlan(), arr({ 10: 100 }));
    expect(q.labels[10]).toBe('baseline');
    expect(q.apu.queue).toHaveLength(76);
    expect(q.lrt.waitMin).toHaveLength(76);
    expect(q.inputs).toEqual(expect.arrayContaining(['timetable', 'shuttle', 'baseline:busSeats', 'baseline:giveUpWaitMin',
      'baseline:giveUpRatePerHour', 'baseline:defaultStayShare', 'baseline:stopOutdoorCapacity']));
  });
  describe('labels with AI estimates', () => {
    const dis: DisruptionRef = { id: 'c1', type: 'manual', kind: 'concert', title: 'c1', venue: null, startMin: 1080, endMin: 1260, expectedAttendance: null };
    const est = (key: Estimate['key'], v: number): Estimate => ({ key, disruptionId: 'c1', likely: v, low: v, high: v, unit: 'share', reasoning: '', confidence: 'medium', model: 't', createdAt: 't', clamped: false });
    // APU service from step 5 so no carry builds up before the 200 arrivals (dep 0, give-up 10).
    const lateApu = () => { const s = fill(true); for (let t = 0; t < 5; t++) s[t] = false; return s; };
    it('advisory compliance: ai from the first changed APU step, unchanged before', () => {
      const b = makeBundle(base, { roadRatio: 1, disruptions: [dis], estimates: [est('advisoryCompliance', 0.6)] });
      const q = run(mkPlan({ serviceApu: fill(false) }), arr({ 22: 100 }), zeros(),
        [{ kind: 'advisory', advisedMin: 720, message: 'leave_before' }], b);
      expect(q.labels[15]).toBe('baseline');
      for (let t = 16; t < STEPS; t++) expect(q.labels[t]).toBe('ai');
    });
    it('dinnerStayShare estimate: ai from the first step with new stayers', () => {
      const b = makeBundle(base, { roadRatio: 1, disruptions: [dis], estimates: [est('dinnerStayShare', 0.5)] });
      const q = run(mkPlan({ serviceApu: lateApu() }, 0.5), arr({ 5: 200 }), zeros(), [], b);
      expect(q.newStayers[5]).toBeCloseTo(5);
      expect(q.labels[4]).toBe('baseline');
      for (let t = 5; t < STEPS; t++) expect(q.labels[t]).toBe('ai');
      expect(q.inputs).toContain('estimate:dinnerStayShare:c1');
    });
    it('no estimates: no ai labels even with give-up', () => {
      const q = run(mkPlan({ serviceApu: lateApu() }, 0.5), arr({ 5: 200 }));
      expect(q.newStayers[5]).toBeCloseTo(3);
      expect(q.labels.every(l => l === 'baseline')).toBe(true);
    });
  });
  it('is deterministic', () => {
    const a = JSON.stringify(run(mkPlan({}, 0.5), arr({ 0: 200 })));
    const b = JSON.stringify(run(mkPlan({}, 0.5), arr({ 0: 200 })));
    expect(a).toBe(b);
  });
});
