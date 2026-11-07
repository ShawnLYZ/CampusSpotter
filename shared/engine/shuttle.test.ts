import { beforeAll, describe, expect, it } from 'vitest';
import { planShuttle } from './shuttle.ts';
import { computeRoad } from './road.ts';
import { stepOf } from './grid.ts';
import { normalWednesday } from '../fixtures/engine/index.ts';
import { makeBundle } from '../fixtures/engine/testkit.ts';
import type { InputBundle } from './types.ts';

let base: InputBundle;
beforeAll(async () => { base = await normalWednesday(); });

const plan = (b: InputBundle, levers: Parameters<typeof planShuttle>[1] = []) => planShuttle(b, levers, computeRoad(b));

describe('planShuttle', () => {
  it('computes rtt and rate from the road ratio', () => {
    const p = plan(makeBundle(base, { roadRatio: 1 }));
    expect(p.rttMin).toHaveLength(76);
    expect(p.rttMin[10]).toBe(18);
    expect(p.ratePerStep[10]).toBe(5);
  });
  it('null ratio gives null rtt and rate', () => {
    const ratio: (number | null)[] = new Array(20).fill(1); ratio[19] = null; ratio[18] = null;
    const p = plan(makeBundle(base, { roadRatio: ratio }));
    expect(p.rttMin[75]).toBeNull();
    expect(p.ratePerStep[75]).toBeNull();
  });
  it('adds extra buses inside the lever window', () => {
    const p = plan(makeBundle(base, { roadRatio: 1 }), [{ kind: 'extraBuses', buses: 2, fromMin: 600, toMin: 840 }]);
    expect(p.fleet[12]).toBe(8);
    expect(p.fleet[11]).toBe(6);
    // stepStartMin(16) = 660 lies inside [600, 840), so the brief's fleet[16] === 6 cannot hold (see report).
    expect(p.fleet[16]).toBe(8);
    expect(p.fleet[27]).toBe(8);
    expect(p.fleet[28]).toBe(6);
  });
  it('normal timetable: schedule, loops, service window, last APU bus', () => {
    const p = plan(makeBundle(base, { roadRatio: 1 }));
    expect(p.schedApu[stepOf(635)]).toBe(1);
    expect(p.loop[2]).toBe(true);
    expect(p.loop[7]).toBe(false);
    expect(p.serviceApu[0]).toBe(false);
    expect(p.serviceApu[2]).toBe(true);
    expect(p.lastApuMin).toBe(1305);
    expect(p.lastApuStep).toBe(stepOf(1305));
    expect(p.serviceApu[stepOf(1305)]).toBe(true);
    expect(p.serviceApu[stepOf(1305) + 1]).toBe(false);
  });
  it('nonstopLoop lever marks loop steps', () => {
    const p = plan(makeBundle(base, { roadRatio: 1 }), [{ kind: 'nonstopLoop', fromMin: 1080, toMin: 1140 }]);
    expect(p.loop[stepOf(1080)]).toBe(true);
    expect(p.loop[stepOf(1125)]).toBe(true);
    expect(p.loop[stepOf(1140)]).toBe(false);
  });
  it('busesAtLrt adds to extraAtLrt', () => {
    const p = plan(makeBundle(base, { roadRatio: 1 }), [{ kind: 'busesAtLrt', buses: 2, atMin: 720 }]);
    expect(p.extraAtLrt[stepOf(720)]).toBe(2);
  });
  it("service 'none' turns every service flag off", () => {
    const p = plan(makeBundle(base, { roadRatio: 1, shuttle: { service: 'none' } }));
    expect(p.serviceApu.every(v => v === false)).toBe(true);
    expect(p.serviceLrt.every(v => v === false)).toBe(true);
    expect(p.lastApuMin).toBeNull();
    expect(p.lastApuStep).toBeNull();
  });
  it('labels and inputs', () => {
    const b = makeBundle(base, { roadRatio: 1 });
    const road = computeRoad(b);
    const p = planShuttle(b, [], road);
    expect(p.labels[10]).toBe('baseline');
    for (const id of road.inputs) expect(p.inputs).toContain(id);
    expect(p.inputs).toContain('shuttle');
    expect(p.inputs).toContain('baseline:freeFlowOneWayMin');
    expect(p.inputs).toContain('baseline:loadingMinPerTerminal');
    expect(p.inputs).toContain('baseline:fleetSize');
  });
});
