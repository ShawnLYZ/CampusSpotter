import { clock12, rmText } from './format.ts';
import { stepStartMin, STEPS } from './grid.ts';
import type { CostLine } from './output.ts';
import type { BlockId, DayType, InputBundle, LeverSet, Settings } from './types.ts';
import { BLOCK_IDS } from './types.ts';
import { activeAt } from './levers.ts';
import { sessionsMovedBySlot } from './demand.ts';

export interface CostLedger {
  hallKwh: number[]; acSavedKwh: number[]; precoolKwh: number[];
  hallKwhByHall: Record<string, number[]>;                     // per waiting hall id
  acSavedByBlock: Record<BlockId, number[]>; precoolByBlock: Record<BlockId, number[]>;
  sessionsMoved: number; sessionsScheduled: number;
}

export function tariffSen(min: number, dayType: DayType, settings: Settings): number {
  const peak = (dayType === 'weekday' || dayType === 'friday')
    && min >= settings.peakFromMin && min < settings.peakToMin;
  return peak ? settings.tariffPeakSenPerKwh.value : settings.tariffOffPeakSenPerKwh.value;
}

const round2 = (x: number): number => {
  const r = Math.round(x * 100) / 100;
  return r === 0 ? 0 : r;
};
const hoursText = (h: number): string => String(Math.round(h * 100) / 100);

export function priceLevers(levers: LeverSet, bundle: InputBundle, ledger: CostLedger): CostLine[] {
  const s = bundle.settings;
  const dayType = bundle.context.dayType;
  const out: CostLine[] = [];
  const kwhCost = (arr: number[]): number => {
    let sum = 0;
    for (let t = 0; t < STEPS; t++) sum += (arr[t] ?? 0) * tariffSen(stepStartMin(t), dayType, s) / 100;
    return sum;
  };
  const sumArr = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);
  /** Keeps only the steps where the lever is active (other steps 0). */
  const inWindow = (w: { fromMin: number; toMin: number }, arr: readonly number[] | undefined): number[] =>
    Array.from({ length: STEPS }, (_, t) => (activeAt(w, stepStartMin(t)) ? (arr?.[t] ?? 0) : 0));

  for (const l of levers) {
    switch (l.kind) {
      case 'extraBuses': {
        const hours = (l.toMin - l.fromMin) / 60;
        let label: string; let rate: number;
        if (hours <= 4) { label = 'half day'; rate = s.busHalfDayRm.value; }
        else if (hours <= 8) { label = 'full day'; rate = s.busFullDayRm.value; }
        else { label = 'full day + half day'; rate = s.busFullDayRm.value + s.busHalfDayRm.value; }
        out.push({
          kind: l.kind,
          text: `${l.buses} × ${bundle.baseline.busSeats.value}-seat bus, ${label} @ ${rmText(rate)}, ${clock12(l.fromMin)}–${clock12(l.toMin)}`,
          rm: round2(l.buses * rate),
        });
        break;
      }
      case 'nonstopLoop':
        out.push({ kind: l.kind, text: `Nonstop loop, ${clock12(l.fromMin)}–${clock12(l.toMin)} (existing fleet)`, rm: 0 });
        break;
      case 'busesAtLrt':
        out.push({ kind: l.kind, text: `${l.buses} bus${l.buses > 1 ? 'es' : ''} waiting at LRT Bukit Jalil from ${clock12(l.atMin)} (existing fleet)`, rm: 0 });
        break;
      case 'cafeteria': {
        const staffRate = s.staffRatePerHourRm.value;
        const perCounter = s.staffPerCounter.value;
        if (l.extraCounters > 0) {
          const h = (l.toMin - l.fromMin) / 60;
          const c = l.extraCounters;
          out.push({
            kind: l.kind,
            text: `${c} extra counter${c > 1 ? 's' : ''} × ${perCounter} staff × ${hoursText(h)} h @ RM ${staffRate}/h`,
            rm: round2(c * perCounter * h * staffRate),
          });
        }
        const outlet = bundle.baseline.cafeterias.find((o) => o.id === l.outletId);
        if (outlet && l.closeAtMin !== null && l.closeAtMin > outlet.closesMin) {
          const h = (l.closeAtMin - outlet.closesMin) / 60;
          const staff = outlet.staff.value;
          out.push({
            kind: l.kind,
            text: `${outlet.name} open until ${clock12(l.closeAtMin)}: ${staff} staff × ${hoursText(h)} h @ RM ${staffRate}/h`,
            rm: round2(staff * h * staffRate),
          });
        }
        break;
      }
      case 'waitingHall': {
        const hall = bundle.baseline.waitingHalls.find((x) => x.id === l.hallId);
        const name = hall ? hall.name : l.hallId;
        const kwh = inWindow(l, ledger.hallKwhByHall[l.hallId]);
        out.push({
          kind: l.kind,
          text: `${name} open ${clock12(l.fromMin)}–${clock12(l.toMin)}: ${Math.round(sumArr(kwh))} kWh @ TNB time-of-use`,
          rm: round2(kwhCost(kwh)),
        });
        break;
      }
      case 'acOffInGap': {
        const sel: readonly BlockId[] = l.blocks === 'all' ? BLOCK_IDS : BLOCK_IDS.filter(b => (l.blocks as BlockId[]).includes(b));
        const net = inWindow(l, Array.from({ length: STEPS }, (_, t) => {
          let v = 0;
          for (const b of sel) v += (ledger.acSavedByBlock[b]?.[t] ?? 0) - (ledger.precoolByBlock[b]?.[t] ?? 0);
          return v;
        }));
        out.push({
          kind: l.kind,
          text: `AC and lights off in empty rooms, ${clock12(l.fromMin)}–${clock12(l.toMin)}: saves ${Math.round(sumArr(net))} kWh`,
          rm: round2(-kwhCost(net)),
        });
        break;
      }
      case 'classesOnline': {
        const moved = sessionsMovedBySlot(bundle, l).reduce((a, x) => a + x.count, 0);
        const pct = ledger.sessionsScheduled > 0 ? Math.round(100 * moved / ledger.sessionsScheduled) : 0;
        out.push({
          kind: l.kind,
          text: `Classes online from ${clock12(l.fromMin)}: ${moved} sessions (no cost; learning disruption ${pct}%)`,
          rm: 0,
        });
        break;
      }
      case 'stagger':
        out.push({ kind: l.kind, text: `Stagger ${l.target} times by block, ${clock12(l.fromMin)}–${clock12(l.toMin)} (no cost)`, rm: 0 });
        break;
      case 'advisory': {
        const a = clock12(l.advisedMin);
        const text = l.message === 'leave_before' ? `Student advisory: leave before ${a} (no cost)`
          : l.message === 'walk_to_lrt' ? `Student advisory: walk to LRT after ${a} (no cost)`
          : `Student advisory: expect delays after ${a} (no cost)`;
        out.push({ kind: l.kind, text, rm: 0 });
        break;
      }
      case 'studentCount':
        break;
    }
  }
  return out;
}
