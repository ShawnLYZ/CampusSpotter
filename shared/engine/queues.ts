import type { InputBundle, Label, LeverSet } from './types.ts';
import type { StepStatus, Warning } from './output.ts';
import type { Demand } from './demand.ts';
import type { ShuttlePlan } from './shuttle.ts';
import { STEPS, STEP_MIN, inGrid, stepOf, zeros } from './grid.ts';
import { EVENT_KINDS, estimateScalar } from './estimates.ts';
import { mergeInputs, weakest } from './provenance.ts';

export interface StopResult { queue: number[]; arrivals: number[]; served: number[]; gaveUp: number[]; waitMin: (number | null)[]; status: StepStatus[] }
export interface QueueResult {
  apu: StopResult; lrt: StopResult; departuresApuToLrt: number[]; departuresLrtToApu: number[];
  stayers: number[]; newStayers: number[]; leftBehind: number; indoorWaiting: number[];
  labels: (Label | null)[]; inputs: string[]; warnings: Warning[];
}

/** Minute at which dinner stayers rejoin the APU queue (for the 8:45 and 9:45 pm runs). */
const STAYERS_REJOIN_MIN = 1230;

const emptyStop = (arrivals: number[]): StopResult => ({
  queue: zeros(), arrivals, served: zeros(), gaveUp: zeros(),
  waitMin: new Array<number | null>(STEPS).fill(null), status: new Array<StepStatus>(STEPS).fill('no_service'),
});

/** Advisory pre-pass on copies of the arrivals. */
function applyAdvisories(bundle: InputBundle, levers: LeverSet, apu: number[], lrt: number[]) {
  const warnings: Warning[] = [];
  const inputs: string[] = [];
  const advisories = levers.filter(l => l.kind === 'advisory');
  if (advisories.length === 0) return { warnings, inputs };
  const est = estimateScalar(bundle, 'advisoryCompliance');
  if (est === null) {
    for (const a of advisories) {
      warnings.push({ code: 'estimate_missing', message: `No advisory compliance estimate; advisory "${a.message}" has no effect.`, metric: 'apuStopQueue' });
    }
    return { warnings, inputs };
  }
  inputs.push(`estimate:advisoryCompliance:${est.disruptionId}`);
  const c = est.value;
  for (const a of advisories) {
    const s = Math.max(0, stepOf(a.advisedMin));
    if (a.message === 'leave_before') {
      // Riders due in the hour after the advised time leave in the hour before; later riders (still in class) stay.
      const from = stepOf(a.advisedMin - 60);
      const to = stepOf(a.advisedMin);
      const end = Math.min(STEPS, stepOf(a.advisedMin + 60));
      for (let t = s; t < end; t++) {
        const m = c * apu[t];
        apu[t] -= m;
        for (let k = from; k < to; k++) if (inGrid(k)) apu[k] += m / 4;
      }
    } else if (a.message === 'walk_to_lrt') {
      for (let t = s; t < STEPS; t++) apu[t] *= 1 - c;
    } else {
      for (let t = s; t < STEPS; t++) {
        const m = c * lrt[t];
        lrt[t] -= m;
        lrt[Math.max(0, t - 2)] += m;
      }
    }
  }
  return { warnings, inputs };
}

export function computeQueues(
  bundle: InputBundle, levers: LeverSet,
  demand: Pick<Demand, 'apuStopArrivals' | 'lrtStopArrivals' | 'label' | 'inputs'>, shuttle: ShuttlePlan,
): QueueResult {
  const bl = bundle.baseline;
  const seats = bl.busSeats.value;
  const giveUpWait = bl.giveUpWaitMin.value;
  const giveUpRate = bl.giveUpRatePerHour.value;
  const outdoor = bl.stopOutdoorCapacity.value;

  const apuArr = demand.apuStopArrivals.slice();
  const lrtArr = demand.lrtStopArrivals.slice();
  const adv = applyAdvisories(bundle, levers, apuArr, lrtArr);
  // First step whose arrivals the advisory pre-pass changed (an AI estimate); 'ai' from there on.
  const firstChanged = (a: number[], b: readonly number[]) => { const i = a.findIndex((v, t) => v !== b[t]); return i < 0 ? Infinity : i; };
  let aiFrom = Math.min(firstChanged(apuArr, demand.apuStopArrivals), firstChanged(lrtArr, demand.lrtStopArrivals));

  const stayEst = estimateScalar(bundle, 'dinnerStayShare', EVENT_KINDS);
  const stayShare = stayEst ? stayEst.value : bl.defaultStayShare.value;

  const apu = emptyStop(apuArr);
  const lrt = emptyStop(lrtArr);
  const depApu = zeros();
  const depLrt = zeros();
  const stayersOut = zeros();
  const newStayers = zeros();
  const indoorWaiting = zeros();
  const labels: (Label | null)[] = [];

  const rejoinStep = stepOf(STAYERS_REJOIN_MIN);
  const last = shuttle.lastApuStep;
  let qa = 0; let ql = 0; let stayers = 0; let leftBehind = 0;
  const carry = { apu: 0, lrt: 0 };

  // A direction with no service at any step does not queue its arrivals (they are only recorded).
  const neverApu = !shuttle.serviceApu.some(Boolean);
  const neverLrt = !shuttle.serviceLrt.some(Boolean);
  // Arrivals during a direction's not_enough_data steps are left out of the modelled queue.
  const excluded = { apu: 0, lrt: 0 };

  for (let t = 0; t < STEPS; t++) {
    const apuClosed = last !== null && t > last;
    const noData = shuttle.rttMin[t] === null || shuttle.ratePerStep[t] === null;
    if (!neverApu) {
      if (!apuClosed && shuttle.serviceApu[t] && noData) excluded.apu += apuArr[t]; else qa += apuArr[t];
    }
    if (!neverLrt) {
      if (shuttle.serviceLrt[t] && noData) excluded.lrt += lrtArr[t]; else ql += lrtArr[t];
    }
    if (t === rejoinStep) { qa += stayers; stayers = 0; }
    if (apuClosed) { leftBehind += apuArr[t]; qa = 0; }

    for (const dir of ['apu', 'lrt'] as const) {
      if (dir === 'apu' && apuClosed) continue;   // stop stays 'no_service', wait null, no departures
      const stop = dir === 'apu' ? apu : lrt;
      const service = dir === 'apu' ? shuttle.serviceApu[t] : shuttle.serviceLrt[t];
      const rate = shuttle.ratePerStep[t];
      if (!service) { stop.status[t] = 'no_service'; continue; }
      if (shuttle.rttMin[t] === null || rate === null) { stop.status[t] = 'not_enough_data'; continue; }

      let q = dir === 'apu' ? qa : ql;
      const avail = rate + carry[dir];
      const fa = Math.floor(avail);
      const sched = dir === 'apu' ? shuttle.schedApu[t] : shuttle.schedLrt[t];
      const wanted = shuttle.loop[t] ? Infinity : Math.max(sched, Math.floor(q / seats));
      let dep = Math.min(fa, wanted);
      carry[dir] = dep === fa ? avail - dep : avail - fa;
      if (dir === 'lrt') dep += shuttle.extraAtLrt[t];
      const served = Math.min(q, dep * seats);
      q -= served;
      const wait = q === 0 ? 0 : q * STEP_MIN / (rate * seats);
      stop.served[t] = served;
      stop.waitMin[t] = wait;
      stop.status[t] = 'ok';
      if (wait > giveUpWait) {
        const g = q * giveUpRate / 4;
        q -= g;
        stop.gaveUp[t] = g;
        if (dir === 'apu') {
          newStayers[t] = g * stayShare; stayers += newStayers[t];
          if (stayEst && newStayers[t] > 0) aiFrom = Math.min(aiFrom, t);
        }
      }
      if (dir === 'apu') { qa = q; depApu[t] = dep; } else { ql = q; depLrt[t] = dep; }
    }

    if (t === last) { leftBehind += qa + stayers; qa = 0; stayers = 0; }
    apu.queue[t] = qa;
    lrt.queue[t] = ql;
    stayersOut[t] = stayers;
    indoorWaiting[t] = Math.max(0, qa - outdoor) + stayers;
    labels.push(weakest(shuttle.labels[t], demand.label, t >= aiFrom ? 'ai' : null));
  }

  const inputs = mergeInputs(
    demand.inputs, shuttle.inputs,
    ['baseline:busSeats', 'baseline:giveUpWaitMin', 'baseline:giveUpRatePerHour',
      stayEst ? `estimate:dinnerStayShare:${stayEst.disruptionId}` : 'baseline:defaultStayShare',
      'baseline:stopOutdoorCapacity'],
    adv.inputs,
  );

  const warnings = adv.warnings.slice();
  for (const [dir, name, metric] of [['apu', 'APU', 'apuStopQueue'], ['lrt', 'LRT', 'lrtStopQueue']] as const) {
    if (excluded[dir] <= 0) continue;
    warnings.push({
      code: 'not_enough_data', metric,
      message: `not enough data: ${Math.round(excluded[dir])} students arriving at the ${name} stop during missing road data are not modelled`,
    });
  }

  return {
    apu, lrt, departuresApuToLrt: depApu, departuresLrtToApu: depLrt,
    stayers: stayersOut, newStayers, leftBehind, indoorWaiting, labels, inputs, warnings,
  };
}
