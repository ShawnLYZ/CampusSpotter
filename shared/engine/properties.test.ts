import { describe, it, expect, beforeAll } from 'vitest';
import { runForecast } from './forecast.ts';
import type { Forecast } from './output.ts';
import type { InputBundle, LeverSet } from './types.ts';
import { STEPS } from './grid.ts';
import { validateLevers } from './levers.ts';
import { computeRoad } from './road.ts';
import { computeDemand } from './demand.ts';
import { planShuttle } from './shuttle.ts';
import { computeQueues } from './queues.ts';
import { REPLAY_PLAN_4NOV } from '../plans/replayPlan.ts';
import { concert4Nov, friday6Nov, normalWednesday } from '../fixtures/engine/index.ts';

const EPS = 1e-6;
const names = ['normalWednesday', 'concert4Nov', 'friday6Nov'] as const;
const bundles = {} as Record<(typeof names)[number], InputBundle>;
const cache = new Map<string, Forecast>();

beforeAll(async () => {
  bundles.normalWednesday = await normalWednesday();
  bundles.concert4Nov = await concert4Nov();
  bundles.friday6Nov = await friday6Nov();
});

function run(name: (typeof names)[number], levers: LeverSet): Forecast {
  const key = name + JSON.stringify(levers);
  let f = cache.get(key);
  if (!f) { f = runForecast(bundles[name], levers); cache.set(key, f); }
  return f;
}

function stayersOf(name: (typeof names)[number], levers: LeverSet): number[] {
  const b = bundles[name];
  const lv = validateLevers(levers, b).levers;
  const road = computeRoad(b);
  const demand = computeDemand(b, lv, road);
  const shuttle = planShuttle(b, lv, road);
  return computeQueues(b, lv, demand, shuttle).stayers;
}

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
const detail = (f: Forecast, m: keyof Forecast['metrics'], k: string) => f.metrics[m].detail[k];

const typical: LeverSet[] = [
  ...REPLAY_PLAN_4NOV.map(l => [l] as LeverSet),
  [{ kind: 'stagger', target: 'end', fromMin: 720, toMin: 1080, shifts: { A: 15, B: -15 } }],
  [{ kind: 'extraBuses', buses: 2, fromMin: 600, toMin: 1320 }],
  [{ kind: 'studentCount', percent: 20 }],
];

describe('lever properties (D26)', () => {
  for (const name of names) {
    describe(name, () => {
      it('queues are never negative (no levers and each lever kind)', () => {
        const sets: LeverSet[] = [[], ...typical];
        expect(new Set(typical.map(s => s[0].kind)).size).toBe(10);
        for (const ls of sets) {
          const f = run(name, ls);
          for (const m of ['apuStopQueue', 'lrtStopQueue', 'cafeteriaQueue'] as const) {
            const q = detail(f, m, 'queue');
            expect(q.length).toBe(STEPS);
            q.forEach((v, t) => {
              if (!(v >= 0)) throw new Error(`${name} ${m} lever=${ls[0]?.kind ?? 'none'} step ${t}: queue ${v}`);
            });
          }
        }
      });

      // D26, scoped to the APU stop by the product owner (D29): the LRT side is public transport
      // and out of scope for this property.
      it('adding buses never makes things worse at the APU stop', () => {
        const buses = (n: number): LeverSet => n === 0 ? [] : [{ kind: 'extraBuses', buses: n, fromMin: 600, toMin: 1320 }];
        for (const n of [1, 2, 3]) {
          const more = run(name, buses(n)); const less = run(name, buses(n - 1));
          const unserved = (f: Forecast, st: number[]) => {
            const q = detail(f, 'apuStopQueue', 'queue'); const g = detail(f, 'apuStopQueue', 'gaveUp');
            let cum = 0;
            return q.map((v, t) => { cum += g[t]; return v + cum + st[t]; });
          };
          const a = unserved(more, stayersOf(name, buses(n))); const b = unserved(less, stayersOf(name, buses(n - 1)));
          a.forEach((v, t) => {
            if (!(v <= b[t] + EPS)) throw new Error(`${name} apuStopQueue n=${n} step ${t}: ${v} > ${b[t]}`);
          });
          const pa = more.summary.peakApuWaitMin ?? 0; const pb = less.summary.peakApuWaitMin ?? 0;
          expect(pa, `${name} n=${n} peak APU`).toBeLessThanOrEqual(pb + EPS);
        }
      });

      // D30: "occupancy" here means students in class. The occupancy percentage can rise when the
      // remaining rooms are fuller than the moved ones, or when students heading home wait indoors.
      it('classes online never raises the number of students in class', () => {
        const base = detail(run(name, []), 'classroomOccupancy', 'inClass');
        const on = detail(run(name, [{ kind: 'classesOnline', fromMin: 645, toMin: 1440, blocks: 'all' }]), 'classroomOccupancy', 'inClass');
        on.forEach((v, t) => {
          if (!(v <= base[t] + EPS)) throw new Error(`${name} inClass step ${t}: ${v} > ${base[t]}`);
        });
      });

      it('student count +X never lowers demand', () => {
        const base = run(name, []);
        for (const x of [10, 30]) {
          const f = run(name, [{ kind: 'studentCount', percent: x }]);
          for (const [m, k] of [['apuStopQueue', 'arrivals'], ['lrtStopQueue', 'arrivals'], ['classroomOccupancy', 'inClass']] as const) {
            expect(sum(detail(f, m, k)), `${name} +${x}% ${m}.${k}`).toBeGreaterThanOrEqual(sum(detail(base, m, k)) - EPS);
          }
        }
      });

      it('is deterministic', () => {
        const ls: LeverSet = [...REPLAY_PLAN_4NOV];
        expect(JSON.stringify(runForecast(bundles[name], ls))).toBe(JSON.stringify(runForecast(bundles[name], ls)));
      });
    });
  }

  it('AC off saves energy and money on friday6Nov', () => {
    const base = run('friday6Nov', []);
    const f = run('friday6Nov', [{ kind: 'acOffInGap', fromMin: 765, toMin: 870, blocks: 'all' }]);
    expect(sum(detail(f, 'buildingEnergy', 'kwh'))).toBeLessThan(sum(detail(base, 'buildingEnergy', 'kwh')));
    const line = f.summary.costLines.find(c => c.kind === 'acOffInGap');
    expect(line).toBeDefined();
    expect(line!.rm).toBeLessThan(0);
  });
});
