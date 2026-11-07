import type { BlockId, InputBundle, Label, LeverSet } from '../types.ts';
import type { Demand } from '../demand.ts';
import type { OccupancyResult } from './occupancy.ts';
import { BLOCK_IDS } from '../types.ts';
import { STEPS, STEP_HOURS, inGrid, stepOf, stepStartMin, zeros } from '../grid.ts';
import { activeAt } from '../levers.ts';
import { weakest } from '../provenance.ts';

export interface EnergyResult {
  kwh: number[]; perBlockKwh: Record<BlockId, number[]>; hallKwh: number[];
  acSavedKwh: number[]; precoolKwh: number[];
  hallKwhByHall: Record<string, number[]>;                     // per waiting hall id (halls used by a lever)
  acSavedByBlock: Record<BlockId, number[]>; precoolByBlock: Record<BlockId, number[]>;
  labels: (Label | null)[]; inputs: string[];
}


export function energyPercent(kwh: number, referenceKwh: number): number {
  return referenceKwh > 0 ? (kwh / referenceKwh - 1) * 100 : 0;
}

export function computeEnergy(bundle: InputBundle, levers: LeverSet, demand: Demand, occupancy: OccupancyResult): EnergyResult {
  const perBlockKwh = {} as Record<BlockId, number[]>;
  const acSavedByBlock = {} as Record<BlockId, number[]>;
  const precoolByBlock = {} as Record<BlockId, number[]>;
  for (const b of BLOCK_IDS) { perBlockKwh[b] = zeros(); acSavedByBlock[b] = zeros(); precoolByBlock[b] = zeros(); }
  const hallKwhByHall: Record<string, number[]> = {};
  const kwh = zeros(); const hallKwh = zeros(); const acSavedKwh = zeros(); const precoolKwh = zeros();
  const labels: (Label | null)[] = new Array<Label | null>(STEPS).fill(null);
  const inputs = ['timetable', ...BLOCK_IDS.map(b => `energy:${b}`)];

  const tt = bundle.timetable;
  if (demand.missing || !tt) {
    return { kwh, perBlockKwh, hallKwh, acSavedKwh, precoolKwh, hallKwhByHall, acSavedByBlock, precoolByBlock, labels, inputs };
  }

  const profileLabels: (Label | null)[] = [];
  for (const b of BLOCK_IDS) {
    const e = bundle.baseline.energy[b];
    profileLabels.push(e.baseLoadKw.label, e.occupiedRoomKw.label, e.idleRoomKw.label);
  }
  const hallIds = new Set<string>();
  const sum = (r: { classroom: number; lab: number; auditorium: number }) => r.classroom + r.lab + r.auditorium;

  for (let t = 0; t < STEPS; t++) {
    const s = stepStartMin(t);
    labels[t] = weakest(tt.label, demand.label, ...profileLabels);
    for (const b of BLOCK_IDS) {
      const prof = bundle.baseline.energy[b];
      const occKw = prof.occupiedRoomKw.value; const idleKw = prof.idleRoomKw.value;
      const occupied = sum(demand.roomsInUse[b][t]) + occupancy.keptOpenRooms[b][t];
      const conditioned = sum(tt.conditioned[b][t]);
      const idle = Math.max(0, conditioned - occupied);

      let precool = 0; let acOff = false;
      for (const l of levers) {
        if (l.kind !== 'acOffInGap' || !(l.blocks === 'all' || l.blocks.includes(b))) continue;
        if (!activeAt(l, s)) continue;
        acOff = true;
        const next = stepOf(l.toMin);
        if (next - 1 === t && inGrid(next)) {
          precool = Math.max(precool, Math.min(idle, sum(demand.roomsInUse[b][next])));
        }
      }
      const idleEff = acOff ? 0 : idle;
      if (acOff) {
        const saved = (idle - precool) * idleKw * STEP_HOURS;
        acSavedKwh[t] += saved; acSavedByBlock[b][t] += saved;
      }
      precoolKwh[t] += precool * occKw * STEP_HOURS;
      precoolByBlock[b][t] += precool * occKw * STEP_HOURS;

      let e = (prof.baseLoadKw.value + occupied * occKw + idleEff * idleKw + precool * occKw) * STEP_HOURS;
      const seen = new Set<string>();
      for (const l of levers) {
        if (l.kind !== 'waitingHall' || !activeAt(l, s) || seen.has(l.hallId)) continue;
        const h = bundle.baseline.waitingHalls.find(x => x.id === l.hallId);
        if (!h || h.block !== b) continue;
        seen.add(l.hallId);
        hallIds.add(l.hallId);
        const hk = h.loadKw.value * STEP_HOURS;
        e += hk; hallKwh[t] += hk;
        (hallKwhByHall[l.hallId] ??= zeros())[t] += hk;
        labels[t] = weakest(labels[t], h.loadKw.label);
      }
      perBlockKwh[b][t] = e;
      kwh[t] += e;
    }
  }
  for (const id of hallIds) inputs.push(`hall:${id}`);
  return { kwh, perBlockKwh, hallKwh, acSavedKwh, precoolKwh, hallKwhByHall, acSavedByBlock, precoolByBlock, labels, inputs };
}
