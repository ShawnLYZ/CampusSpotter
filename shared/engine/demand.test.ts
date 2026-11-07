import { beforeAll, describe, expect, it } from 'vitest';
import { computeDemand, sessionsMovedBySlot } from './demand.ts';
import { computeRoad } from './road.ts';
import type { RoadResult } from './road.ts';
import { normalWednesday } from '../fixtures/engine/index.ts';
import { makeBundle, lab } from '../fixtures/engine/testkit.ts';
import { BLOCK_IDS } from './types.ts';
import type { DisruptionRef, Estimate, InputBundle, SessionGroup } from './types.ts';

let base: InputBundle;
let road1: RoadResult;
beforeAll(async () => {
  base = await normalWednesday();
  road1 = computeRoad(makeBundle(base, { roadRatio: 1 }));
});

const g1: SessionGroup = { block: 'A', roomType: 'classroom', startMin: 510, endMin: 630, count: 10, firstOfDayShare: 1, lastOfDayShare: 0.5 };
const g2: SessionGroup = { block: 'A', roomType: 'classroom', startMin: 660, endMin: 780, count: 10, firstOfDayShare: 0, lastOfDayShare: 1 };
const g3: SessionGroup = { block: 'A', roomType: 'classroom', startMin: 660, endMin: 780, count: 1, firstOfDayShare: 1, lastOfDayShare: 1 };

const dis = (id: string, kind: DisruptionRef['kind']): DisruptionRef => ({
  id, type: 'manual', kind, title: id, venue: null, startMin: 1080, endMin: 1260, expectedAttendance: lab(1000) });
const est = (key: Estimate['key'], disruptionId: string, likely: number): Estimate => ({
  key, disruptionId, likely, low: likely, high: likely, unit: 'x', reasoning: '', confidence: 'medium', model: 't', createdAt: 't', clamped: false });

describe('computeDemand', () => {
  it('[g1]: occupancy, leaving, between-class, arriving and stop arrivals', () => {
    const b = makeBundle(base, { groups: [g1], roadRatio: 1, disruptions: [], estimates: [] });
    const d = computeDemand(b, [], road1);
    expect(d.missing).toBe(false);
    expect(d.inClass.A).toHaveLength(76);
    expect(d.inClass.A[6]).toBe(255);
    expect(d.inClass.A[13]).toBe(255);
    expect(d.inClass.A[14]).toBe(0);
    expect(d.inClass.A[5]).toBe(0);
    expect(d.roomsInUse.A[6].classroom).toBe(10);
    expect(d.roomsInUse.A[14].classroom).toBe(0);
    expect(d.leaving[14]).toBeCloseTo(63.75, 10);
    expect(d.leaving[15]).toBeCloseTo(63.75, 10);
    expect(d.leaving[16]).toBe(0);
    expect(d.betweenEnders[14]).toBeCloseTo(127.5, 10);
    expect(d.endersSpread[14]).toBeCloseTo(127.5, 10);
    for (const t of [3, 4, 5]) {
      expect(d.arriving[t]).toBeCloseTo(85, 10);
      expect(d.startersSpread[t]).toBeCloseTo(85, 10);
    }
    expect(d.arriving[2]).toBe(0);
    expect(d.apuStopArrivals[14]).toBeCloseTo(18.965625, 10);
    expect(d.lrtStopArrivals[3]).toBeCloseTo(25.2875, 10);
    expect(d.sessionsScheduled).toBe(10);
    expect(d.sessionsMoved).toBe(0);
    for (const k of ['leaving', 'arriving', 'apuStopArrivals', 'lrtStopArrivals', 'prayerOut', 'lunchCandidates'] as const) {
      expect(d[k]).toHaveLength(76);
    }
    expect(d.inputs).toContain('timetable');
    expect(d.inputs).toContain('baseline:attendeesPerSession');
    expect(d.inputs).toContain('baseline:shuttleShare');
    expect(d.label).toBe('baseline');
    expect(d.fridayLunchSpreadSteps).toBe(b.baseline.lunchSpreadMin.value / 15);
  });

  it('roadRatio 3 shifts LRT-stop arrivals one step earlier', () => {
    const b = makeBundle(base, { groups: [g1], roadRatio: 3, disruptions: [], estimates: [] });
    const d = computeDemand(b, [], computeRoad(b));
    expect(d.lrtStopArrivals[2]).toBeCloseTo(25.2875, 10);
    expect(d.lrtStopArrivals[5]).toBe(0);
  });

  it('classesOnline moves later sessions and raises last-of-day share (D19)', () => {
    const b = makeBundle(base, { groups: [g1, g2], disruptions: [], estimates: [] });
    const d = computeDemand(b, [{ kind: 'classesOnline', fromMin: 600, toMin: 1560, blocks: 'all' }], road1);
    expect(d.sessionsMoved).toBe(10);
    expect(d.sessionsScheduled).toBe(20);
    expect(d.leaving[14]).toBeCloseTo(127.5, 10);
    expect(d.betweenEnders[14]).toBe(0);
    expect(d.inClass.A[18]).toBe(0);
    expect(b.timetable!.groups).toEqual([g1, g2]);   // bundle not mutated
  });

  it('classesOnline only affects selected blocks', () => {
    const b = makeBundle(base, { groups: [g1, g2], disruptions: [], estimates: [] });
    const d = computeDemand(b, [{ kind: 'classesOnline', fromMin: 600, toMin: 1560, blocks: ['B'] }], road1);
    expect(d.sessionsMoved).toBe(0);
    expect(d.inClass.A[18]).toBe(255);
  });

  it('stagger end shifts the end and the leaving', () => {
    const b = makeBundle(base, { groups: [g1], disruptions: [], estimates: [] });
    const d = computeDemand(b, [{ kind: 'stagger', target: 'end', fromMin: 600, toMin: 660, shifts: { A: 15 } }], road1);
    expect(d.inClass.A[14]).toBe(255);
    expect(d.leaving[14]).toBe(0);
    expect(d.leaving[15]).toBeCloseTo(63.75, 10);
    expect(d.leaving[16]).toBeCloseTo(63.75, 10);
  });

  it('stagger start moves start and end', () => {
    const b = makeBundle(base, { groups: [g1], disruptions: [], estimates: [] });
    const d = computeDemand(b, [{ kind: 'stagger', target: 'start', fromMin: 500, toMin: 520, shifts: { A: 15 } }], road1);
    expect(d.inClass.A[6]).toBe(0);
    expect(d.inClass.A[14]).toBe(255);
    expect(d.arriving[3]).toBe(0);
    expect(d.arriving[6]).toBeCloseTo(85, 10);
  });

  it('studentCount scales students per session', () => {
    const b = makeBundle(base, { groups: [g1], disruptions: [], estimates: [] });
    const d = computeDemand(b, [{ kind: 'studentCount', percent: 20 }], road1);
    expect(d.inClass.A[6]).toBeCloseTo(306, 10);
  });

  it('applies the attendance drop from dropFromMin', () => {
    const b = makeBundle(base, { groups: [g1, g3], disruptions: [dis('c1', 'concert')], estimates: [est('attendanceDrop', 'c1', 0.35)] });
    const d = computeDemand(b, [], { ...road1, dropFromMin: 600 });
    expect(d.inClass.A[18]).toBeCloseTo(16.575, 10);
    expect(d.inClass.A[6]).toBe(255);
    expect(d.inputs).toContain('estimate:attendanceDrop:c1');
    expect(d.label).toBe('ai');
    const none = computeDemand(b, [], road1);   // dropFromMin null → no drop
    expect(none.inClass.A[18]).toBeCloseTo(25.5, 10);
    expect(none.inputs).not.toContain('estimate:attendanceDrop:c1');
  });

  it('M8: a Friday without a prayer time warns that lunch is not split', () => {
    const b = makeBundle(base, { dayType: 'friday', zuhrMin: null, disruptions: [], estimates: [] });
    const d = computeDemand(b, [], computeRoad(b));
    expect(d.warnings).toContainEqual({ code: 'not_enough_data', message: 'not enough data: Friday prayer time missing; lunch not split' });
    const w = makeBundle(base, { dayType: 'weekday', zuhrMin: null, disruptions: [], estimates: [] });
    expect(computeDemand(w, [], computeRoad(w)).warnings).toEqual([]);
  });
  it('Friday prayer: out/back flows and reduced lunch candidates', () => {
    const fg: SessionGroup = { block: 'A', roomType: 'classroom', startMin: 600, endMin: 720, count: 10, firstOfDayShare: 1, lastOfDayShare: 0 };
    const b = makeBundle(base, { groups: [fg], dayType: 'friday', zuhrMin: 780, disruptions: [], estimates: [] });
    const d = computeDemand(b, [], road1);
    expect(d.prayerOut[21]).toBeCloseTo(38.25, 10);
    expect(d.prayerOut[22]).toBeCloseTo(38.25, 10);
    expect(d.prayerOut[20]).toBe(0);
    expect(d.prayerOut[23]).toBe(0);
    expect(d.prayerBack[28]).toBeCloseTo(38.25, 10);
    expect(d.prayerBack[29]).toBeCloseTo(38.25, 10);
    expect(d.prayerBack[30]).toBe(0);
    expect(d.lunchCandidates[20]).toBeCloseTo(178.5, 10);
    expect(d.fridayLunchSpreadSteps).toBe(2);
    expect(d.inputs).toContain('prayer');
    expect(d.inputs).toContain('baseline:fridayPrayerShare');
  });

  it('non-Friday lunch candidates equal between-class enders in [690, 840)', () => {
    const fg: SessionGroup = { block: 'A', roomType: 'classroom', startMin: 600, endMin: 720, count: 10, firstOfDayShare: 1, lastOfDayShare: 0 };
    const b = makeBundle(base, { groups: [fg, g1], disruptions: [], estimates: [] });
    const d = computeDemand(b, [], road1);
    expect(d.lunchCandidates[20]).toBeCloseTo(255, 10);
    expect(d.lunchCandidates[14]).toBe(0);   // g1 ends at 630, before lunch
    expect(d.prayerOut.every(v => v === 0)).toBe(true);
  });

  it('intake shuttle demand adds x/12 per step to both stops', () => {
    const o = { groups: [g1], disruptions: [dis('i1', 'intake')] };
    const without = computeDemand(makeBundle(base, { ...o, estimates: [] }), [], road1);
    const b = makeBundle(base, { ...o, estimates: [est('intakeShuttleDemand', 'i1', 600)] });
    const d = computeDemand(b, [], road1);
    for (const t of [4, 15]) expect(d.lrtStopArrivals[t] - without.lrtStopArrivals[t]).toBeCloseTo(50, 10);
    for (const t of [3, 16]) expect(d.lrtStopArrivals[t] - without.lrtStopArrivals[t]).toBeCloseTo(0, 10);
    for (const t of [32, 43]) expect(d.apuStopArrivals[t] - without.apuStopArrivals[t]).toBeCloseTo(50, 10);
    for (const t of [31, 44]) expect(d.apuStopArrivals[t] - without.apuStopArrivals[t]).toBeCloseTo(0, 10);
    expect(d.inputs).toContain('estimate:intakeShuttleDemand:i1');
    expect(d.label).toBe('ai');
  });

  it('a null timetable gives missing, zeros and a null label', () => {
    const b = makeBundle(base, {});
    b.timetable = null;
    const d = computeDemand(b, [], road1);
    expect(d.missing).toBe(true);
    expect(d.label).toBeNull();
    for (const k of ['endersSpread', 'startersSpread', 'leaving', 'arriving', 'betweenEnders', 'lunchCandidates',
      'apuStopArrivals', 'lrtStopArrivals', 'prayerOut', 'prayerBack'] as const) {
      expect(d[k]).toHaveLength(76);
      expect(d[k].every(v => v === 0)).toBe(true);
    }
    for (const id of BLOCK_IDS) {
      expect(d.inClass[id].every(v => v === 0)).toBe(true);
      expect(d.roomsInUse[id].every(c => c.classroom === 0 && c.lab === 0 && c.auditorium === 0)).toBe(true);
    }
    expect(d.sessionsScheduled).toBe(0);
  });

  it('is deterministic', () => {
    const b = makeBundle(base, { groups: [g1, g2] });
    expect(JSON.stringify(computeDemand(b, [], road1))).toBe(JSON.stringify(computeDemand(b, [], road1)));
  });
});

describe('sessionsMovedBySlot', () => {
  it('aggregates moved groups per block and start, sorted', () => {
    const groups: SessionGroup[] = [
      g1, g2,
      { ...g2, roomType: 'lab', count: 3 },
      { ...g2, block: 'B', startMin: 600, endMin: 720, count: 4 },
      { ...g2, block: 'C', startMin: 660, count: 2 },
    ];
    const b = makeBundle(base, { groups });
    const r = sessionsMovedBySlot(b, { kind: 'classesOnline', fromMin: 600, toMin: 1560, blocks: ['A', 'B'] });
    expect(r).toEqual([
      { block: 'B', startMin: 600, count: 4 },
      { block: 'A', startMin: 660, count: 13 },
    ]);
  });
  it('returns [] for a null timetable', () => {
    const b = makeBundle(base, {}); b.timetable = null;
    expect(sessionsMovedBySlot(b, { kind: 'classesOnline', fromMin: 600, toMin: 1560, blocks: 'all' })).toEqual([]);
  });
});
