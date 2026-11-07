import type { InputBundle, LeverSet } from '../types.ts';
import type { StepStatus } from '../output.ts';
import type { Demand } from '../demand.ts';
import type { QueueResult } from '../queues.ts';
import type { Series } from '../series.ts';
import { STEPS, STEP_MIN, inGrid, stepOf, stepStartMin, zeros } from '../grid.ts';
import { EVENT_KINDS, estimateScalar } from '../estimates.ts';
import { makeSeries } from '../series.ts';
import { activeAt } from '../levers.ts';
import { mergeInputs, weakest } from '../provenance.ts';

export interface CafeteriaResult { wait: Series; queue: number[]; arrivals: number[]; served: number[]; unserved: number }

const DINNER_FROM = 1080;
const DINNER_TO = 1200;

export function computeCafeteria(bundle: InputBundle, levers: LeverSet, demand: Demand, queues: QueueResult): CafeteriaResult {
  const bl = bundle.baseline;
  const outlet = bl.cafeterias[0];
  const eat = bl.eatOnCampusShare;
  const diner = outlet.dinerShare.value;
  const lunchShare = eat.value * diner;

  const arrivals = zeros();
  const queue = zeros();
  const served = zeros();

  const stayEst = estimateScalar(bundle, 'dinnerStayShare', EVENT_KINDS);
  const stayInput = stayEst ? `estimate:dinnerStayShare:${stayEst.disruptionId}` : 'baseline:defaultStayShare';
  const stayLabel = stayEst ? 'ai' as const : bl.defaultStayShare.label;

  let dinnerArrivals = 0;
  if (!demand.missing) {
    const k = Math.max(1, Math.round(demand.fridayLunchSpreadSteps));
    for (let e = 0; e < STEPS; e++) {
      const c = demand.lunchCandidates[e] * lunchShare;
      if (c === 0) continue;
      for (let t = e + 1; t <= e + k; t++) if (inGrid(t)) arrivals[t] += c / k;
    }
    for (let t = 0; t < STEPS; t++) arrivals[t] += demand.prayerBack[t] * lunchShare;
    const d0 = stepOf(DINNER_FROM);
    const d1 = stepOf(DINNER_TO);
    const dinner = zeros();
    for (let t = d0; t < d1; t++) if (inGrid(t)) dinner[t] += queues.newStayers[t] * diner;
    for (let t = d0; t < d0 + 4; t++) if (inGrid(t)) dinner[t] += (queues.stayers[d0] - queues.newStayers[d0]) * diner / 4;
    for (let t = 0; t < STEPS; t++) { arrivals[t] += dinner[t]; dinnerArrivals += dinner[t]; }
  }

  const inputs = mergeInputs(
    demand.inputs, [`cafeteria:${outlet.id}`, 'baseline:eatOnCampusShare'],
    dinnerArrivals > 0 ? [stayInput] : [],
  );
  const label = weakest(demand.label, outlet.counters.label, outlet.servicePerCounter15.label, outlet.dinerShare.label,
    eat.label, dinnerArrivals > 0 ? stayLabel : null);

  if (demand.missing) {
    const nulls = new Array<number | null>(STEPS).fill(null);
    return {
      wait: makeSeries(nulls, null, inputs, new Array<StepStatus>(STEPS).fill('not_enough_data')),
      queue, arrivals, served, unserved: 0,
    };
  }

  const waits: (number | null)[] = new Array<number | null>(STEPS).fill(null);
  const status: StepStatus[] = new Array<StepStatus>(STEPS).fill('no_service');
  let q = 0; let unserved = 0;
  for (let t = 0; t < STEPS; t++) {
    const s = stepStartMin(t);
    let close = outlet.closesMin;
    let counters = outlet.counters.value;
    for (const l of levers) {
      if (l.kind !== 'cafeteria' || l.outletId !== outlet.id || !activeAt(l, s)) continue;
      counters += l.extraCounters;
      if (l.closeAtMin !== null) close = Math.max(close, l.closeAtMin);
    }
    q += arrivals[t];
    const service = counters * outlet.servicePerCounter15.value;
    if (s >= outlet.opensMin && s < close && service > 0) {
      served[t] = Math.min(q, service);
      q -= served[t];
      waits[t] = q * STEP_MIN / service;
      status[t] = 'ok';
    } else {
      unserved += q;
      q = 0;
    }
    queue[t] = q;
  }
  return { wait: makeSeries(waits, label, inputs, status), queue, arrivals, served, unserved };
}
