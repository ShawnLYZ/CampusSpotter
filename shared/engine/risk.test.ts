import { describe, it, expect, beforeAll } from 'vitest';
import { scoreRisk } from './risk.ts';
import { topPeaks } from './summary.ts';
import type { Forecast, MetricSeries, Peak, StepValue, Summary } from './output.ts';
import type { Context, MetricId, Settings } from './types.ts';
import { METRIC_IDS } from './types.ts';
import { METRIC_UNITS } from './output.ts';
import { normalWednesday } from '../fixtures/engine/index.ts';

let settings: Settings;
beforeAll(async () => { settings = (await normalWednesday()).settings; });

const perMetric = <T>(make: () => T): Record<MetricId, T> => {
  const out = {} as Record<MetricId, T>;
  for (const m of METRIC_IDS) out[m] = make();
  return out;
};

interface FakePartial {
  summary?: Partial<Omit<Summary, 'redMinutes' | 'amberMinutes' | 'peaks'>> & {
    redMinutes?: Partial<Record<MetricId, number>>;
    amberMinutes?: Partial<Record<MetricId, number>>;
    peaks?: Partial<Record<MetricId, Peak>>;
  };
  context?: Partial<Context>;
  metrics?: Partial<Record<MetricId, StepValue[]>>;
}

function fakeForecast(p: FakePartial = {}): Forecast {
  const s = p.summary ?? {};
  const summary: Summary = {
    peaks: { ...perMetric((): Peak => ({ value: 0, atMin: 420 })), ...s.peaks },
    redMinutes: { ...perMetric(() => 0), ...s.redMinutes },
    amberMinutes: { ...perMetric(() => 0), ...s.amberMinutes },
    peakApuWaitMin: s.peakApuWaitMin ?? 0, peakApuQueue: s.peakApuQueue ?? { value: 0, atMin: 420 },
    peakLrtWaitMin: s.peakLrtWaitMin ?? 0, totalRedMinutes: s.totalRedMinutes ?? 0, lastApuMin: s.lastApuMin ?? 1305,
    studentHoursWaited: 0, leftBehind: s.leftBehind ?? 0, extraEnergyKwh: 0, extraEnergyRm: 0,
    costLines: [], totalCostRm: 0,
    learningDisruption: s.learningDisruption ?? { sessionsMoved: 0, sessionsScheduled: 0, share: 0 },
  };
  const metrics = {} as Record<MetricId, MetricSeries>;
  for (const m of METRIC_IDS) {
    metrics[m] = { metric: m, unit: METRIC_UNITS[m], steps: p.metrics?.[m] ?? [], inputs: ['x'], detail: {} };
  }
  return {
    engineVersion: 'test',
    context: { date: '2026-11-18', dayType: 'weekday', disruptions: [], reconstructed: false, ...p.context },
    levers: [], metrics, perBlock: {} as Forecast['perBlock'], summary, risk: null, warnings: [],
  };
}

const ok = (value: number, pressure: StepValue['pressure']): StepValue => ({ value, status: 'ok', pressure, provenance: 'baseline' });

describe('scoreRisk', () => {
  it('120 red minutes on the APU stop is critical', () => {
    expect(scoreRisk(fakeForecast({ summary: { redMinutes: { apuStopQueue: 120 } } }), settings).level).toBe('critical');
  });
  it('an APU wait above the critical limit is critical with the APU reason', () => {
    const r = scoreRisk(fakeForecast({ summary: { peakApuWaitMin: 130, peaks: { apuStopQueue: { value: 130, atMin: 1095 } } } }), settings);
    expect(r.level).toBe('critical');
    expect(r.reason).toBe('APU stop wait peaks at 2 h 10 min around 6:15 PM');
    expect(r.worst).toEqual({ metric: 'apuStopQueue', value: 130, atMin: 1095 });
  });
  it('many students left behind is critical with the left-behind reason', () => {
    const r = scoreRisk(fakeForecast({ summary: { leftBehind: 140, lastApuMin: 1305 } }), settings);
    expect(r.level).toBe('critical');
    expect(r.reason).toBe('About 140 students left behind after the last bus at 9:45 PM');
    expect(r.worst).toEqual({ metric: 'apuStopQueue', value: 140, atMin: 1305 });
  });
  it('30 red minutes at the cafeteria is high', () => {
    const r = scoreRisk(fakeForecast({ summary: { redMinutes: { cafeteriaQueue: 30 }, peaks: { cafeteriaQueue: { value: 40, atMin: 750 } } } }), settings);
    expect(r.level).toBe('high');
    expect(r.worst?.metric).toBe('cafeteriaQueue');
  });
  it('60 amber minutes on the walkway is medium', () => {
    const r = scoreRisk(fakeForecast({ summary: { amberMinutes: { walkwayTraffic: 60 } } }), settings);
    expect(r.level).toBe('medium');
    expect(r.worst?.metric).toBe('walkwayTraffic');
  });
  it('red road on a weekend is medium with the weekend prefix', () => {
    const r = scoreRisk(fakeForecast({
      context: { dayType: 'weekend' },
      summary: {
        redMinutes: { roadDelay: 15 }, peaks: { roadDelay: { value: 3.2, atMin: 1200 } },
        learningDisruption: { sessionsMoved: 0, sessionsScheduled: 15, share: 0 },
      },
    }), settings);
    expect(r.level).toBe('medium');
    expect(r.reason.startsWith('Weekend (no shuttle, 15 sessions): Road time reaches')).toBe(true);
    expect(r.reason).toBe('Weekend (no shuttle, 15 sessions): Road time reaches 3.2× free-flow around 8:00 PM');
  });
  it('a no-class day with everything green is low', () => {
    const r = scoreRisk(fakeForecast({ context: { dayType: 'no_class' } }), settings);
    expect(r.level).toBe('low');
    expect(r.reason).toBe('No classes today');
    expect(r.worst).toBeNull();
  });
  it('an all-green weekday is low with the all-green reason', () => {
    const r = scoreRisk(fakeForecast({ metrics: { walkwayTraffic: [ok(10, 'green')] } }), settings);
    expect(r).toEqual({ level: 'low', reason: 'No metric goes above green', worst: null });
  });
  it('a low no-class day keeps the plain reason; a higher one adds the phrase', () => {
    const r = scoreRisk(fakeForecast({
      context: { dayType: 'no_class' },
      summary: { redMinutes: { cafeteriaQueue: 30 }, peaks: { cafeteriaQueue: { value: 40, atMin: 750 } } },
    }), settings);
    expect(r.level).toBe('high');
    expect(r.reason).toBe('No classes today, but cafeteria wait peaks at 40 min around 12:30 PM');
  });
});

describe('topPeaks', () => {
  it('sorts metrics by value / redAbove over ok steps', () => {
    const red = settings.thresholds;
    const f = fakeForecast({
      metrics: {
        walkwayTraffic: [ok(0.5 * red.walkwayTraffic.redAbove, 'green'), ok(0.9 * red.walkwayTraffic.redAbove, 'amber')],
        roadDelay: [ok(1.2 * red.roadDelay.redAbove, 'red'),
          { value: null, status: 'not_enough_data', pressure: null, provenance: null }],
      },
    });
    const p = topPeaks(f, settings);
    expect(p.map(x => x.metric)).toEqual(['roadDelay', 'walkwayTraffic']);
    expect(p[0]).toEqual({ metric: 'roadDelay', value: 1.2 * red.roadDelay.redAbove, atMin: 420, pressure: 'red' });
    expect(p[1].atMin).toBe(435);
    expect(topPeaks(f, settings, 1)).toHaveLength(1);
  });
});
