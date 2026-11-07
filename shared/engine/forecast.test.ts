import { describe, it, expect, beforeAll } from 'vitest';
import { compareScenarios, evaluatePlan, referenceBundle, runForecast } from './forecast.ts';
import type { DisruptionRef, Estimate, InputBundle } from './types.ts';
import { METRIC_IDS } from './types.ts';
import { stepStartMin } from './grid.ts';
import { REPLAY_PLAN_4NOV as REPLAY } from '../plans/replayPlan.ts';
import { btsWeekend12Dec, missingRoadAfter9pm, normalWednesday } from '../fixtures/engine/index.ts';
import { makeBundle } from '../fixtures/engine/testkit.ts';

let b: InputBundle;
beforeAll(async () => { b = await normalWednesday(); });

const concert: DisruptionRef = {
  id: 'test-concert', type: 'stadium_event', kind: 'concert', title: 'Test concert', venue: 'Axiata Arena',
  startMin: 1200, endMin: 1380, expectedAttendance: { value: 10000, label: 'verified', sourceId: 'test' },
};
const uplift: Estimate = {
  key: 'eventRoadUplift', disruptionId: 'test-concert',
  likely: [1, 1, 1, 1, 1, 1, 1.1, 1.2, 1.4, 1.6, 2, 2.4, 2.5, 2.2, 1.8, 1.6, 1.4, 1.2, 1.1, 1],
  low: 1, high: 3, unit: 'ratio', reasoning: 'test', confidence: 'medium', model: 'test', createdAt: '2026-11-05T09:00:00+08:00', clamped: false,
};

describe('runForecast', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(runForecast(b, REPLAY))).toBe(JSON.stringify(runForecast(b, REPLAY)));
    expect(JSON.stringify(compareScenarios(b, REPLAY))).toBe(JSON.stringify(compareScenarios(b, REPLAY)));
  });

  it('does not mutate the input bundle', () => {
    const before = JSON.stringify(b);
    runForecast(b, REPLAY);
    referenceBundle(b);
    expect(JSON.stringify(b)).toBe(before);
  });

  it('every metric lists its inputs and has 76 steps', () => {
    const f = runForecast(b, []);
    for (const m of METRIC_IDS) {
      expect(f.metrics[m].inputs.length, m).toBeGreaterThan(0);
      expect(f.metrics[m].steps, m).toHaveLength(76);
      for (const arr of Object.values(f.metrics[m].detail)) expect(arr, m).toHaveLength(76);
    }
    expect(Object.keys(f.metrics.classroomOccupancy.detail)).toEqual(['inClass', 'waitingIndoors', 'seats']);
    expect(Object.keys(f.metrics.cafeteriaQueue.detail)).toEqual(['queue', 'arrivals']);
    expect(Object.keys(f.metrics.buildingEnergy.detail)).toEqual(['kwh', 'referenceKwh']);
    expect(Object.keys(f.metrics.walkwayTraffic.detail)).toEqual(['flowPerMin']);
    expect(Object.keys(f.metrics.apuStopQueue.detail)).toEqual(['queue', 'arrivals', 'served', 'gaveUp']);
    expect(Object.keys(f.metrics.lrtStopQueue.detail)).toEqual(['queue', 'arrivals', 'served', 'gaveUp']);
    expect(Object.keys(f.metrics.shuttleRtt.detail)).toEqual(['departuresApuToLrt', 'departuresLrtToApu', 'fleet']);
    expect(Object.keys(f.metrics.lrtCrowding.detail)).toEqual(['normalFlow', 'eventFlow']);
    expect(f.metrics.roadDelay.detail).toEqual({});
  });

  it('never gives a pressure or provenance to a missing value', () => {
    const f = runForecast(b, []);
    for (const m of METRIC_IDS) {
      for (const s of f.metrics[m].steps) {
        if (s.status !== 'ok') { expect(s.value, m).toBeNull(); expect(s.pressure, m).toBeNull(); }
        if (s.value === null) expect(s.provenance, m).toBeNull();
      }
    }
  });

  it('a no-lever run is scored and a plan run is not', () => {
    expect(runForecast(b, []).risk).not.toBeNull();
    expect(runForecast(b, REPLAY).risk).toBeNull();
  });

  it('takes the weakest label: a concert road uplift makes the round trip ai', () => {
    const withUplift = makeBundle(b, { disruptions: [concert], estimates: [uplift] });
    expect(runForecast(withUplift, []).metrics.shuttleRtt.steps[44].provenance).toBe('ai');
    expect(runForecast(b, []).metrics.shuttleRtt.steps[44].provenance).toBe('baseline');
  });

  it('Review Focus 4: missing road data after 9 pm', async () => {
    const f = runForecast(await missingRoadAfter9pm(), []);
    // Brief says shuttleRtt 0–52 'ok', but the fixture's first service (loop) starts 7:30 AM (step 2), so by the
    // brief's own status rule (service is checked before road data) steps 0–1 are 'no_service'. Reported as a concern.
    expect(f.metrics.shuttleRtt.steps[0].status).toBe('no_service');
    expect(f.metrics.shuttleRtt.steps[1].status).toBe('no_service');
    for (const m of ['roadDelay', 'shuttleRtt'] as const) {
      for (let t = m === 'shuttleRtt' ? 2 : 0; t <= 52; t++) expect(f.metrics[m].steps[t].status, `${m} ${t}`).toBe('ok');
      for (let t = 53; t <= 75; t++) expect(f.metrics[m].steps[t].status, `${m} ${t}`).toBe('not_enough_data');
    }
    const apu = f.metrics.apuStopQueue.steps;
    for (let t = 53; t <= 59; t++) expect(apu[t].status, `apu ${t}`).toBe('not_enough_data');
    for (let t = 60; t <= 75; t++) expect(apu[t].status, `apu ${t}`).toBe('no_service');
    expect(f.warnings.some(w => w.code === 'not_enough_data' && w.metric === 'roadDelay' && w.fromMin === 1215 && w.toMin === 1560)).toBe(true);
    const w = f.warnings.find(x => x.code === 'not_enough_data' && x.metric === 'roadDelay')!;
    expect(w.message).toBe('not enough data: road delay missing 8:15 PM–2:00 AM');
    expect(f.warnings.some(x => x.code === 'not_enough_data' && x.metric === 'apuStopQueue'
      && x.fromMin === stepStartMin(53) && x.toMin === stepStartMin(59) + 15)).toBe(true);
  });

  it('F3: missing road data after 9 pm strands nobody; one warning names the unmodelled arrivals', async () => {
    const f = runForecast(await missingRoadAfter9pm(), []);
    const normal = runForecast(b, []);
    expect(normal.summary.leftBehind).toBe(0);
    expect(f.summary.leftBehind).toBe(normal.summary.leftBehind);
    const w = f.warnings.filter(x => x.code === 'not_enough_data' && x.metric === 'apuStopQueue' && x.fromMin === undefined);
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/^not enough data: \d+ students arriving at the APU stop during missing road data are not modelled$/);
  });

  it('F2: a no-shuttle day queues nobody at the stops and keeps nobody waiting indoors', async () => {
    const f = runForecast(await btsWeekend12Dec(), []);
    expect(f.metrics.apuStopQueue.detail.queue.every(v => v === 0)).toBe(true);
    expect(f.metrics.lrtStopQueue.detail.queue.every(v => v === 0)).toBe(true);
    expect(f.metrics.classroomOccupancy.detail.waitingIndoors.every(v => v === 0)).toBe(true);
    expect(f.summary.peakApuQueue.value).toBe(0);
    expect(f.summary.studentHoursWaited).toBe(0);
    expect(f.summary.leftBehind).toBe(0);
    expect(f.metrics.apuStopQueue.steps.every(s => s.status === 'no_service')).toBe(true);
  });

  it('Review Focus 5: a manual concert without estimates runs and warns', () => {
    const manual = makeBundle(b, { disruptions: [{ ...concert, id: 'manual-1', type: 'manual' }], estimates: [] });
    let f: ReturnType<typeof runForecast> | undefined;
    expect(() => { f = runForecast(manual, [{ kind: 'advisory', advisedMin: 1200, message: 'leave_before' }]); }).not.toThrow();
    expect(() => runForecast(manual, [])).not.toThrow();
    expect(runForecast(manual, []).warnings.some(w => w.code === 'estimate_missing')).toBe(true);
    expect(f!.warnings.some(w => w.code === 'estimate_missing')).toBe(true);
  });

  it('only main-run warnings are reported (no weather warning from the reference run)', () => {
    const f = runForecast(b, []);
    expect(f.warnings.filter(w => w.code === 'weather_missing')).toHaveLength(b.weather === null ? 1 : 0);
  });
});

describe('F1: per-lever pricing in a full run', () => {
  const hall = (from: number, to: number) => ({ kind: 'waitingHall' as const, hallId: 'main-hall', fromMin: from, toMin: to });
  it('two hall windows 5–7 pm + 7–10 pm cost the same as one 5–10 pm window (46.98)', () => {
    const one = runForecast(b, [hall(1020, 1320)]).summary;
    const two = runForecast(b, [hall(1020, 1140), hall(1140, 1320)]).summary;
    expect(one.totalCostRm).toBeCloseTo(46.98, 2);
    expect(Math.abs(two.totalCostRm - 46.98)).toBeLessThanOrEqual(0.011);
  });
  it('two AC-off windows together cost the sum of each window alone', () => {
    const lv = (from: number, to: number) => ({ kind: 'acOffInGap' as const, fromMin: from, toMin: to, blocks: 'all' as const });
    // Non-adjacent windows, so each keeps the same pre-cool as when run alone.
    const a = runForecast(b, [lv(720, 780)]).summary.totalCostRm;
    const c = runForecast(b, [lv(840, 900)]).summary.totalCostRm;
    const two = runForecast(b, [lv(720, 780), lv(840, 900)]).summary.totalCostRm;
    const parts = a + c;
    expect(a).toBeLessThan(0);
    expect(c).toBeLessThan(0);
    expect(Math.abs(two - parts)).toBeLessThanOrEqual(0.011);
  });
});

describe('Review Focus 3: a hall window past midnight', () => {
  it('1380–1500 is priced at off-peak, including the steps after 1440', () => {
    const f = runForecast(b, [{ kind: 'waitingHall', hallId: 'main-hall', fromMin: 1380, toMin: 1500 }]);
    const [line] = f.summary.costLines;
    expect(line.text).toBe('Main Hall, Block B (assumed) open 11:00 PM–1:00 AM: 60 kWh @ TNB time-of-use');
    expect(line.rm).toBe(Math.round(60 * b.settings.tariffOffPeakSenPerKwh.value) / 100);
  });
});

describe('M7: total cost', () => {
  it('is rounded to 2 dp', () => {
    const f = runForecast(b, [
      { kind: 'waitingHall', hallId: 'main-hall', fromMin: 1020, toMin: 1320 },
      { kind: 'acOffInGap', fromMin: 720, toMin: 840, blocks: 'all' },
      { kind: 'acOffInGap', fromMin: 600, toMin: 660, blocks: 'all' },
    ]);
    const raw = f.summary.costLines.reduce((a, c) => a + c.rm, 0);
    expect(f.summary.totalCostRm).toBe(Math.round(raw * 100) / 100);
    expect(String(f.summary.totalCostRm)).toMatch(/^-?\d+(\.\d{1,2})?$/);
  });
});

describe('evaluatePlan', () => {
  it('flags a plan over budget', () => {
    const e = evaluatePlan(b, [{ kind: 'extraBuses', buses: 3, fromMin: 600, toMin: 1080 }], 2000);
    expect(e.withPlan.summary.totalCostRm).toBe(2850);
    expect(e.overBudget).toBe(true);
    expect(e.noAction.levers).toEqual([]);
  });
});

describe('referenceBundle', () => {
  it('drops disruptions, estimates and weather and uses typical road ratios', () => {
    const r = referenceBundle(makeBundle(b, { disruptions: [concert], estimates: [uplift] }));
    expect(r.context.disruptions).toEqual([]);
    expect(r.estimates).toEqual([]);
    expect(r.weather).toBeNull();
    expect(r.road.kind).toBe('typical');
    expect(r.road.ratio.map(p => p!.value)).toEqual(b.baseline.typicalRoadRatio.value);
    expect(r.road.ratio[0]!.label).toBe(b.baseline.typicalRoadRatio.label);
    expect(r.road.googleStaticOneWayMin).toEqual(b.road.googleStaticOneWayMin);
  });
});
