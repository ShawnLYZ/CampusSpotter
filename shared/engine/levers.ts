import type { InputBundle, Lever, LeverKind, LeverSet } from './types.ts';
import type { Warning } from './output.ts';
import { DAY_START_MIN, STEPS, STEP_MIN, stepOf, stepStartMin } from './grid.ts';
import { clock12 } from './format.ts';

export interface LeverSpec {
  kind: LeverKind; team: 'academic' | 'transport' | 'cafeteria' | 'facilities' | 'whatif';
  title: string; description: string; costRule: string;
}

export const LEVER_CATALOGUE: LeverSpec[] = [
  { kind: 'classesOnline', team: 'academic', title: 'Classes online',
    description: 'Sessions starting inside the window become off-campus; demand at LRT, campus and cafeteria drops.',
    costRule: 'RM 0; learning disruption = sessions moved ÷ sessions scheduled (shown as % and count)' },
  { kind: 'stagger', team: 'academic', title: 'Stagger end times',
    description: 'Moves session end (and the related demand) by the shift of each block (0–30 min).',
    costRule: 'RM 0' },
  { kind: 'extraBuses', team: 'transport', title: 'Extra buses',
    description: 'Fleet rises within the time window.',
    costRule: 'Per bus: window ≤ 4 h → RM 650 (half day); ≤ 8 h → RM 950 (full day); > 8 h → RM 950 + RM 650' },
  { kind: 'nonstopLoop', team: 'transport', title: 'Nonstop loop',
    description: 'Timed departures are replaced by continuous loop departures.',
    costRule: 'RM 0 (existing fleet)' },
  { kind: 'busesAtLrt', team: 'transport', title: 'Buses waiting at LRT',
    description: 'That many buses start at the LRT end, so the first LRT departures happen at once.',
    costRule: 'Uses the existing fleet: RM 0; any extra buses are priced as above' },
  { kind: 'cafeteria', team: 'cafeteria', title: 'Cafeteria counters / hours',
    description: 'More service capacity and/or longer opening.',
    costRule: 'Staff per counter (Baseline 2) × hours × RM 10/h; extended hours: outlet staff (Baseline 6) × extra hours × RM 10/h' },
  { kind: 'waitingHall', team: 'facilities', title: 'Waiting hall',
    description: 'Waiting students move indoors (occupancy) and the hall adds energy.',
    costRule: 'kWh × time-of-use tariff' },
  { kind: 'acOffInGap', team: 'facilities', title: 'AC off in gap',
    description: 'Idle-room energy is 0 in the window, plus pre-cool.',
    costRule: 'Negative cost (saving) shown in RM' },
  { kind: 'advisory', team: 'academic', title: 'Student advisory',
    description: 'Moves an AI-estimated compliance share of demand earlier.',
    costRule: 'RM 0' },
  { kind: 'studentCount', team: 'whatif', title: 'Student count',
    description: 'Scales population demand (-30% to +50%).',
    costRule: 'n/a (what-if only)' },
];

/** A windowed lever is active at a step starting at `stepStart` when fromMin ≤ stepStart < toMin. */
export function activeAt(lever: { fromMin: number; toMin: number }, stepStart: number): boolean {
  return lever.fromMin <= stepStart && stepStart < lever.toMin;
}

const MIN_T = DAY_START_MIN;
const MAX_T = DAY_START_MIN + STEPS * STEP_MIN;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function validateLevers(levers: LeverSet, bundle: InputBundle): { levers: LeverSet; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const out: Lever[] = [];
  const dropped = (kind: string, why: string) =>
    warnings.push({ code: 'lever_dropped', message: `${kind}: dropped (${why})` });
  const fit = (kind: string, what: string, v: number, lo: number, hi: number, round = false): number => {
    const r = clamp(round ? Math.round(v) : v, lo, hi);
    if (r !== v) warnings.push({ code: 'lever_adjusted', message: `${kind}: ${what} adjusted from ${v} to ${r}` });
    return r;
  };

  for (const original of levers) {
    const l = structuredClone(original) as Lever;
    const kind = l.kind;
    switch (l.kind) {
      case 'busesAtLrt':
        l.atMin = fit(kind, 'atMin', l.atMin, MIN_T, MAX_T);
        l.buses = fit(kind, 'buses', l.buses, 1, Math.max(1, bundle.baseline.fleetSize.value), true);
        break;
      case 'advisory':
        l.advisedMin = fit(kind, 'advisedMin', l.advisedMin, MIN_T, MAX_T);
        break;
      case 'studentCount':
        l.percent = fit(kind, 'percent', l.percent, -30, 50);
        break;
      default: {
        l.fromMin = fit(kind, 'fromMin', l.fromMin, MIN_T, MAX_T);
        l.toMin = fit(kind, 'toMin', l.toMin, MIN_T, MAX_T);
        if (l.fromMin >= l.toMin) { dropped(kind, 'empty window'); continue; }
        if (l.kind === 'stagger') {
          for (const [b, s] of Object.entries(l.shifts)) {
            if (s !== undefined) (l.shifts as Record<string, number>)[b] = fit(kind, `shift ${b}`, s, 0, 30);
          }
        } else if (l.kind === 'extraBuses') {
          l.buses = fit(kind, 'buses', l.buses, 1, 10, true);
        } else if (l.kind === 'cafeteria') {
          const outlet = bundle.baseline.cafeterias.find(c => c.id === l.outletId);
          if (!outlet) { dropped(kind, `unknown outlet ${l.outletId}`); continue; }
          if (l.closeAtMin !== null) l.closeAtMin = fit(kind, 'closeAtMin', l.closeAtMin, MIN_T, l.toMin);
          if (outlet !== bundle.baseline.cafeterias[0]) {
            warnings.push({ code: 'lever_adjusted', message: `${outlet.name}: not modelled; cost only` });
          }
        } else if (l.kind === 'waitingHall') {
          if (!bundle.baseline.waitingHalls.some(h => h.id === l.hallId)) { dropped(kind, `unknown hall ${l.hallId}`); continue; }
        }
      }
    }
    out.push(l);
  }

  warnings.push(...serviceHourWarnings(out, bundle));

  let lastSc = -1;
  out.forEach((l, i) => { if (l.kind === 'studentCount') lastSc = i; });
  return { levers: out.filter((l, i) => l.kind !== 'studentCount' || i === lastSc), warnings };
}

/** Shuttle levers that act outside shuttle service hours have no effect (values are kept; F4). */
function serviceHourWarnings(levers: readonly Lever[], bundle: InputBundle): Warning[] {
  const sh = bundle.shuttle;
  const out: Warning[] = [];
  const warn = (kind: string, text: string) =>
    out.push({ code: 'lever_adjusted', message: `${kind}: ${text}` });
  const noneText = 'outside shuttle service hours, no shuttle service on this day';
  const allDeps = [...sh.apuToLrt, ...sh.lrtToApu].map(d => d.min);
  const none = sh.service === 'none' || allDeps.length === 0;
  const lastDep = none ? null : Math.max(...allDeps);
  // LRT-end service (as planShuttle): from the earliest loop start or LRT departure through the step of the last LRT departure.
  const loopStarts = [...sh.loops.map(w => w.fromMin), ...levers.flatMap(l => (l.kind === 'nonstopLoop' ? [l.fromMin] : []))];
  const lrtDeps = sh.lrtToApu.map(d => d.min);
  const lrtNone = sh.service === 'none' || lrtDeps.length === 0;
  const lrtFirst = lrtNone ? null : Math.min(...lrtDeps, ...loopStarts);
  const lrtLast = lrtNone ? null : Math.max(...lrtDeps);

  for (const l of levers) {
    if (l.kind === 'nonstopLoop' || l.kind === 'extraBuses') {
      if (lastDep === null) { warn(l.kind, noneText); continue; }
      if (l.toMin > stepStartMin(stepOf(lastDep)) + STEP_MIN) {
        warn(l.kind, `${clock12(l.fromMin)}–${clock12(l.toMin)} outside shuttle service hours, no effect after ${clock12(lastDep)}`);
      }
    } else if (l.kind === 'busesAtLrt') {
      if (lrtFirst === null || lrtLast === null) {
        warn(l.kind, lastDep === null ? noneText : 'outside shuttle service hours, no LRT departures on this day');
        continue;
      }
      const t = stepOf(l.atMin);
      if (t > stepOf(lrtLast)) warn(l.kind, `${clock12(l.atMin)} outside shuttle service hours, no effect after ${clock12(lrtLast)}`);
      else if (t < stepOf(lrtFirst)) warn(l.kind, `${clock12(l.atMin)} outside shuttle service hours, no effect before ${clock12(lrtFirst)}`);
    }
  }
  return out;
}
