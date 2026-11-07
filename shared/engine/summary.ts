import type { InputBundle, MetricId, Settings } from './types.ts';
import type { CostLine, Forecast, MetricSeries, Peak, Pressure, Summary } from './output.ts';
import type { Demand } from './demand.ts';
import type { ShuttlePlan } from './shuttle.ts';
import type { QueueResult } from './queues.ts';
import { METRIC_IDS, PRIMARY_METRICS } from './types.ts';
import { STEPS, STEP_HOURS, STEP_MIN, stepStartMin } from './grid.ts';
import { tariffSen } from './costs.ts';


function peakOf(series: MetricSeries): Peak {
  let value: number | null = null; let atMin: number | null = null;
  series.steps.forEach((s, t) => {
    if (s.status !== 'ok' || s.value === null) return;
    if (value === null || s.value > value) { value = s.value; atMin = stepStartMin(t); }
  });
  return { value, atMin };
}

const minutesAt = (series: MetricSeries, p: Pressure): number =>
  STEP_MIN * series.steps.filter(s => s.pressure === p).length;

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const round2 = (x: number): number => { const r = Math.round(x * 100) / 100; return r === 0 ? 0 : r; };

export interface SummaryParts {
  bundle: InputBundle; metrics: Record<MetricId, MetricSeries>;
  demand: Demand; shuttle: ShuttlePlan; queues: QueueResult;
  kwh: number[]; referenceKwh: number[]; costLines: CostLine[];
}

export function summarize(p: SummaryParts): Summary {
  const { bundle, metrics, demand, shuttle, queues, kwh, referenceKwh, costLines } = p;
  const peaks = {} as Record<MetricId, Peak>;
  const redMinutes = {} as Record<MetricId, number>;
  const amberMinutes = {} as Record<MetricId, number>;
  for (const m of METRIC_IDS) {
    peaks[m] = peakOf(metrics[m]);
    redMinutes[m] = minutesAt(metrics[m], 'red');
    amberMinutes[m] = minutesAt(metrics[m], 'amber');
  }

  const apuQueue = queues.apu.queue;
  let peakApuQueue: Peak = { value: null, atMin: null };
  for (let t = 0; t < STEPS; t++) {
    if (peakApuQueue.value === null || apuQueue[t] > peakApuQueue.value) peakApuQueue = { value: apuQueue[t], atMin: stepStartMin(t) };
  }

  let studentHours = 0; let extraRm = 0;
  for (let t = 0; t < STEPS; t++) {
    studentHours += (queues.apu.queue[t] + queues.lrt.queue[t]) * STEP_HOURS;
    const d = kwh[t] - referenceKwh[t];
    extraRm += d * tariffSen(stepStartMin(t), bundle.context.dayType, bundle.settings) / 100;
  }
  const extraKwh = sum(kwh) - sum(referenceKwh);

  const scheduled = demand.sessionsScheduled;
  const moved = demand.sessionsMoved;
  return {
    peaks, redMinutes, amberMinutes,
    peakApuWaitMin: peaks.apuStopQueue.value, peakApuQueue, peakLrtWaitMin: peaks.lrtStopQueue.value,
    totalRedMinutes: PRIMARY_METRICS.reduce((a, m) => a + redMinutes[m], 0),
    lastApuMin: shuttle.lastApuMin,
    studentHoursWaited: studentHours, leftBehind: queues.leftBehind,
    extraEnergyKwh: extraKwh, extraEnergyRm: extraRm,
    costLines, totalCostRm: round2(sum(costLines.map(c => c.rm))),
    learningDisruption: { sessionsMoved: moved, sessionsScheduled: scheduled, share: scheduled > 0 ? moved / scheduled : 0 },
  };
}

export interface TopPeak { metric: MetricId; value: number; atMin: number; pressure: Pressure }

/** Metrics ranked by severity = max over ok steps of value / redAbove (ties keep METRIC_IDS order). */
export function topPeaks(f: Forecast, settings: Pick<Settings, 'thresholds'>, n: number = METRIC_IDS.length): TopPeak[] {
  const ranked: (TopPeak & { severity: number })[] = [];
  for (const m of METRIC_IDS) {
    const redAbove = settings.thresholds[m].redAbove;
    let best: (TopPeak & { severity: number }) | null = null;
    f.metrics[m].steps.forEach((s, t) => {
      if (s.status !== 'ok' || s.value === null || s.pressure === null) return;
      const severity = s.value / redAbove;
      if (best === null || severity > best.severity) {
        best = { metric: m, value: s.value, atMin: stepStartMin(t), pressure: s.pressure, severity };
      }
    });
    if (best !== null) ranked.push(best);
  }
  ranked.sort((a, b) => b.severity - a.severity);
  return ranked.slice(0, n).map(({ metric, value, atMin, pressure }) => ({ metric, value, atMin, pressure }));
}
