import type { Departure, InputBundle, Label, LeverSet } from './types.ts';
import type { RoadResult } from './road.ts';
import { STEPS, STEP_MIN, inGrid, stepOf, stepStartMin, zeros } from './grid.ts';
import { mergeInputs, weakest } from './provenance.ts';
import { activeAt } from './levers.ts';

export interface ShuttlePlan {
  rttMin: (number | null)[]; fleet: number[]; ratePerStep: (number | null)[];
  schedApu: number[]; schedLrt: number[]; loop: boolean[]; serviceApu: boolean[]; serviceLrt: boolean[];
  lastApuStep: number | null; lastApuMin: number | null; extraAtLrt: number[];
  labels: (Label | null)[]; inputs: string[];
}

function schedule(deps: readonly Departure[]): number[] {
  const out = zeros();
  for (const d of deps) {
    const t = stepOf(d.min);
    if (inGrid(t)) out[t] += 1;
  }
  return out;
}

/** Steps from the earliest loop start or first departure through the step of the last departure (inclusive). */
function serviceWindow(deps: readonly Departure[], loopStarts: readonly number[], none: boolean): boolean[] {
  const out = new Array<boolean>(STEPS).fill(false);
  if (none || deps.length === 0) return out;
  const first = Math.min(...deps.map(d => d.min), ...loopStarts);
  const last = Math.max(...deps.map(d => d.min));
  const a = stepOf(first);
  const b = stepOf(last);
  for (let t = 0; t < STEPS; t++) if (t >= a && t <= b) out[t] = true;
  return out;
}

export function planShuttle(bundle: InputBundle, levers: LeverSet, road: RoadResult): ShuttlePlan {
  const bl = bundle.baseline;
  const sh = bundle.shuttle;
  const ff = bl.freeFlowOneWayMin.value;
  const loading = bl.loadingMinPerTerminal.value;
  const none = sh.service === 'none';

  const rttMin: (number | null)[] = [];
  const fleet: number[] = [];
  const ratePerStep: (number | null)[] = [];
  const loop: boolean[] = [];
  const labels: (Label | null)[] = [];

  const loopWindows = [
    ...sh.loops.map(w => ({ fromMin: w.fromMin, toMin: w.toMin })),
    ...levers.flatMap(l => (l.kind === 'nonstopLoop' ? [{ fromMin: l.fromMin, toMin: l.toMin }] : [])),
  ];

  for (let t = 0; t < STEPS; t++) {
    const s = stepStartMin(t);
    const ratio = road.ratio[t];
    const rtt = ratio === null ? null : 2 * ff * ratio + 2 * loading;
    let f = bl.fleetSize.value;
    for (const l of levers) if (l.kind === 'extraBuses' && activeAt(l, s)) f += l.buses;
    rttMin.push(rtt);
    fleet.push(f);
    ratePerStep.push(rtt === null ? null : f * STEP_MIN / rtt);
    loop.push(loopWindows.some(w => activeAt(w, s)));
    labels.push(weakest(road.labels[t], bl.freeFlowOneWayMin.label, bl.loadingMinPerTerminal.label));
  }

  const extraAtLrt = zeros();
  for (const l of levers) {
    if (l.kind !== 'busesAtLrt') continue;
    const t = stepOf(l.atMin);
    if (inGrid(t)) extraAtLrt[t] += l.buses;
  }

  const loopStarts = loopWindows.map(w => w.fromMin);
  const lastApuMin = none || sh.apuToLrt.length === 0 ? null : Math.max(...sh.apuToLrt.map(d => d.min));

  return {
    rttMin, fleet, ratePerStep,
    schedApu: schedule(sh.apuToLrt), schedLrt: schedule(sh.lrtToApu), loop,
    serviceApu: serviceWindow(sh.apuToLrt, loopStarts, none),
    serviceLrt: serviceWindow(sh.lrtToApu, loopStarts, none),
    lastApuStep: lastApuMin === null ? null : stepOf(lastApuMin), lastApuMin, extraAtLrt,
    labels,
    inputs: mergeInputs(road.inputs, ['shuttle', 'baseline:freeFlowOneWayMin', 'baseline:loadingMinPerTerminal', 'baseline:fleetSize']),
  };
}
