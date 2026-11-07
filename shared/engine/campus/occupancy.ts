import type { BlockId, InputBundle, Label, LeverSet, RoomType } from '../types.ts';
import type { StepStatus } from '../output.ts';
import type { Demand } from '../demand.ts';
import type { QueueResult } from '../queues.ts';
import type { Series } from '../series.ts';
import { BLOCK_IDS } from '../types.ts';
import { STEPS, stepStartMin, zeros } from '../grid.ts';
import { makeSeries } from '../series.ts';
import { activeAt } from '../levers.ts';
import { mergeInputs, weakest } from '../provenance.ts';

export interface OccupancyResult {
  campus: Series; perBlock: Record<BlockId, Series>;
  indoorByBlock: Record<BlockId, number[]>; keptOpenRooms: Record<BlockId, number[]>;
  hallOccupants: number[]; seatsByBlock: Record<BlockId, number[]>;
}

const ROOM_TYPES: readonly RoomType[] = ['classroom', 'lab', 'auditorium'];

const perBlockRecord = <T>(make: () => T): Record<BlockId, T> => {
  const out = {} as Record<BlockId, T>;
  for (const id of BLOCK_IDS) out[id] = make();
  return out;
};

export function computeOccupancy(bundle: InputBundle, levers: LeverSet, demand: Demand, queues: QueueResult): OccupancyResult {
  const kept = bundle.baseline.keptOpenBlock;
  const indoorByBlock = perBlockRecord(zeros);
  const keptOpenRooms = perBlockRecord(zeros);
  const seatsByBlock = perBlockRecord(zeros);
  const hallOccupants = zeros();
  const baseInputs = mergeInputs(demand.inputs, ['seats']);

  if (demand.missing) {
    const nulls = () => new Array<number | null>(STEPS).fill(null);
    const nes = () => new Array<StepStatus>(STEPS).fill('not_enough_data');
    return {
      campus: makeSeries(nulls(), null, baseInputs, nes()),
      perBlock: perBlockRecord(() => makeSeries(nulls(), null, baseInputs, nes())),
      indoorByBlock, keptOpenRooms, hallOccupants, seatsByBlock,
    };
  }

  const halls = bundle.baseline.waitingHalls;
  const hallIds = new Set<string>();
  let indoorUsed = false; let keptUsed = false;

  const blockVals = perBlockRecord(() => new Array<number | null>(STEPS).fill(null));
  const blockLabels = perBlockRecord(() => new Array<Label | null>(STEPS).fill(null));
  const campusVals = new Array<number | null>(STEPS).fill(null);
  const campusLabels = new Array<Label | null>(STEPS).fill(null);

  for (let t = 0; t < STEPS; t++) {
    const s = stepStartMin(t);
    let indoor = queues.indoorWaiting[t];
    if (indoor > 0) indoorUsed = true;

    let cap = 0;
    const stepHalls = new Set<string>();
    for (const l of levers) {
      if (l.kind !== 'waitingHall' || !activeAt(l, s)) continue;
      const h = halls.find(x => x.id === l.hallId);
      if (!h || stepHalls.has(l.hallId)) continue;
      stepHalls.add(l.hallId);
      hallIds.add(l.hallId);
      cap += h.capacity.value;
    }
    if (cap > 0) {
      hallOccupants[t] = Math.min(indoor, cap);
      indoor -= hallOccupants[t];
    }

    const totalRooms: Record<string, number> = {};
    let all = 0;
    for (const b of BLOCK_IDS) {
      const r = demand.roomsInUse[b][t];
      totalRooms[b] = r.classroom + r.lab + r.auditorium;
      all += totalRooms[b];
    }
    for (const b of BLOCK_IDS) {
      if (all > 0) indoorByBlock[b][t] = indoor * totalRooms[b] / all;
    }
    if (all === 0 && indoor > 0) {
      indoorByBlock[kept][t] = indoor;
      keptOpenRooms[kept][t] = Math.ceil(indoor / bundle.seats[kept].classroom.value);
      keptUsed = true;
    }

    let sumOcc = 0; let sumSeats = 0;
    const stepLabels: (Label | null)[] = [];
    for (const b of BLOCK_IDS) {
      const r = demand.roomsInUse[b][t];
      let seats = 0; const bl: (Label | null)[] = [];
      for (const type of ROOM_TYPES) {
        if (r[type] > 0) { seats += r[type] * bundle.seats[b][type].value; bl.push(bundle.seats[b][type].label); }
      }
      if (keptOpenRooms[b][t] > 0) {
        seats += keptOpenRooms[b][t] * bundle.seats[b].classroom.value;
        bl.push(bundle.seats[b].classroom.label);
      }
      seatsByBlock[b][t] = seats;
      const occupants = demand.inClass[b][t] + indoorByBlock[b][t];
      blockVals[b][t] = seats > 0 ? occupants / seats * 100 : 0;
      blockLabels[b][t] = weakest(demand.label, ...bl, indoorByBlock[b][t] > 0 ? queues.labels[t] : null);
      sumOcc += occupants; sumSeats += seats;
      stepLabels.push(...bl);
    }
    campusVals[t] = sumSeats > 0 ? sumOcc / sumSeats * 100 : 0;
    campusLabels[t] = weakest(demand.label, ...stepLabels, queues.indoorWaiting[t] > 0 ? queues.labels[t] : null);
  }

  const inputs = mergeInputs(
    baseInputs,
    indoorUsed ? queues.inputs : [],
    indoorUsed ? ['baseline:stopOutdoorCapacity'] : [],
    keptUsed ? ['baseline:keptOpenBlock'] : [],
    [...hallIds].map(id => `hall:${id}`),
  );
  const perBlock = {} as Record<BlockId, Series>;
  for (const b of BLOCK_IDS) perBlock[b] = makeSeries(blockVals[b], blockLabels[b], inputs);
  return {
    campus: makeSeries(campusVals, campusLabels, inputs),
    perBlock,
    indoorByBlock, keptOpenRooms, hallOccupants, seatsByBlock,
  };
}
