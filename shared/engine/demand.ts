import type { BlockId, InputBundle, Label, Lever, LeverSet, RoomCounts, SessionGroup } from './types.ts';
import type { Warning } from './output.ts';
import type { RoadResult } from './road.ts';
import { BLOCK_IDS } from './types.ts';
import { STEPS, inGrid, stepOf, stepStartMin, zeros } from './grid.ts';
import { EVENT_KINDS, estimateScalar } from './estimates.ts';
import { mergeInputs, weakest } from './provenance.ts';

export interface Demand {
  missing: boolean;                                   // timetable null
  inClass: Record<BlockId, number[]>; roomsInUse: Record<BlockId, RoomCounts[]>;
  endersSpread: number[]; startersSpread: number[];   // all students, for walkway
  leaving: number[]; arriving: number[];              // campus trips (first/last of day)
  betweenEnders: number[];                            // at the end step
  lunchCandidates: number[];                          // between-class enders with end in [690, 840), minus Friday prayer-goers, at the end step
  fridayLunchSpreadSteps: number;                     // 2 on Fridays (before-prayer lunch within 30 min), else lunchSpreadMin/15
  apuStopArrivals: number[]; lrtStopArrivals: number[];
  prayerOut: number[]; prayerBack: number[];
  sessionsScheduled: number; sessionsMoved: number;
  label: Label | null; inputs: string[]; warnings: Warning[];
}

type ClassesOnline = Extract<Lever, { kind: 'classesOnline' }>;
interface PlacedGroup extends SessionGroup { moved: boolean }

const LUNCH_FROM = 690;
const LUNCH_TO = 840;
const INTAKE_STEPS = 12;

const zeroCounts = (): RoomCounts => ({ classroom: 0, lab: 0, auditorium: 0 });
const inSel = (block: BlockId, sel: ClassesOnline['blocks']) => sel === 'all' || sel.includes(block);
const spreadSteps = (min: number) => Math.max(1, Math.round(min / 15));

/** Adds `total` spread evenly over k steps starting at `from`; steps outside the grid are dropped. */
function spread(arr: number[], from: number, k: number, total: number): void {
  for (let t = from; t < from + k; t++) if (inGrid(t)) arr[t] += total / k;
}
/** Spreads `total` over the steps [stepOf(fromMin), stepOf(toMin)). */
function spreadWindow(arr: number[], fromMin: number, toMin: number, total: number): void {
  const a = stepOf(fromMin);
  const k = stepOf(toMin) - a;
  if (k > 0) spread(arr, a, k, total);
}

/** Applies the timetable levers (D19) to copies of the groups. */
function placeGroups(groups: readonly SessionGroup[], levers: LeverSet): PlacedGroup[] {
  const out: PlacedGroup[] = groups.map(g => ({ ...g, moved: false }));
  for (const l of levers) {
    if (l.kind !== 'stagger' || l.target !== 'end') continue;
    for (const g of out) if (g.endMin >= l.fromMin && g.endMin < l.toMin) g.endMin += l.shifts[g.block] ?? 0;
  }
  for (const l of levers) {
    if (l.kind !== 'stagger' || l.target !== 'start') continue;
    for (const g of out) {
      if (g.startMin >= l.fromMin && g.startMin < l.toMin) {
        const s = l.shifts[g.block] ?? 0;
        g.startMin += s; g.endMin += s;
      }
    }
  }
  for (const l of levers) {
    if (l.kind !== 'classesOnline') continue;
    for (const g of out) if (g.startMin >= l.fromMin && g.startMin < l.toMin && inSel(g.block, l.blocks)) g.moved = true;
  }
  return out;
}

function emptyDemand(fridayLunchSpreadSteps: number): Demand {
  const inClass = {} as Record<BlockId, number[]>;
  const roomsInUse = {} as Record<BlockId, RoomCounts[]>;
  for (const id of BLOCK_IDS) {
    inClass[id] = zeros();
    roomsInUse[id] = Array.from({ length: STEPS }, zeroCounts);
  }
  return {
    missing: false, inClass, roomsInUse,
    endersSpread: zeros(), startersSpread: zeros(), leaving: zeros(), arriving: zeros(),
    betweenEnders: zeros(), lunchCandidates: zeros(), fridayLunchSpreadSteps,
    apuStopArrivals: zeros(), lrtStopArrivals: zeros(), prayerOut: zeros(), prayerBack: zeros(),
    sessionsScheduled: 0, sessionsMoved: 0, label: null, inputs: [], warnings: [],
  };
}

export function computeDemand(bundle: InputBundle, levers: LeverSet, road: RoadResult): Demand {
  const bl = bundle.baseline;
  const isFriday = bundle.context.dayType === 'friday' && bundle.prayer !== null;
  const fridayLunchSpreadSteps = isFriday ? 2 : bl.lunchSpreadMin.value / 15;
  const d = emptyDemand(fridayLunchSpreadSteps);
  if (bundle.context.dayType === 'friday' && bundle.prayer === null) {
    d.warnings.push({ code: 'not_enough_data', message: 'not enough data: Friday prayer time missing; lunch not split' });
  }

  const tt = bundle.timetable;
  if (tt === null) {
    d.missing = true;
    d.inputs = ['timetable'];
    return d;
  }

  // 1. Levers
  const groups = placeGroups(tt.groups, levers);
  for (const g of groups) {
    d.sessionsScheduled += g.count;
    if (g.moved) d.sessionsMoved += g.count;
  }

  // 2. Students per session
  let pct = 0;
  for (const l of levers) if (l.kind === 'studentCount') pct = l.percent;
  const perSession = bl.attendeesPerSession.value * bl.attendanceRate.value * (1 + pct / 100);
  const drop = road.dropFromMin !== null ? estimateScalar(bundle, 'attendanceDrop', EVENT_KINDS) : null;
  const studentsOf = (g: SessionGroup) =>
    g.count * perSession * (drop !== null && g.startMin >= (road.dropFromMin as number) ? 1 - drop.value : 1);

  // 3. Shares after moving (D19)
  const share = (pick: (g: PlacedGroup) => boolean) => {
    let all = 0; let moved = 0;
    for (const g of groups) if (pick(g)) { all += g.count; if (g.moved) moved += g.count; }
    return all > 0 ? moved / all : 0;
  };
  const movedAfter = (m: number) => share(g => g.startMin >= m);
  const movedBefore = (m: number) => share(g => g.endMin <= m);

  // 4. Per on-campus group
  const kl = spreadSteps(bl.leaveSpreadMin.value);
  const ka = spreadSteps(bl.arriveSpreadMin.value);
  const z = isFriday ? bundle.prayer!.zuhrMin.value : 0;
  const prayerShare = bl.fridayPrayerShare.value;
  let goers = 0;
  for (const g of groups) {
    if (g.moved) continue;
    const n = studentsOf(g);
    const last = g.lastOfDayShare + (1 - g.lastOfDayShare) * movedAfter(g.endMin);
    const first = g.firstOfDayShare + (1 - g.firstOfDayShare) * movedBefore(g.startMin);

    for (let t = 0; t < STEPS; t++) {
      const s = stepStartMin(t);
      if (s >= g.startMin && s < g.endMin) {
        d.inClass[g.block][t] += n;
        d.roomsInUse[g.block][t][g.roomType] += g.count;
      }
    }
    const endStep = stepOf(g.endMin);
    spread(d.endersSpread, endStep, kl, n);
    spread(d.leaving, endStep, kl, n * last);
    const between = n * (1 - last);
    if (inGrid(endStep)) d.betweenEnders[endStep] += between;
    const startStep = stepOf(g.startMin);
    spread(d.startersSpread, startStep - ka, ka, n);
    spread(d.arriving, startStep - ka, ka, n * first);

    // 7–8. Friday prayer and lunch
    const prayerGoer = isFriday && g.endMin >= LUNCH_FROM && g.endMin < z - 15;
    if (prayerGoer) goers += prayerShare * between;
    if (g.endMin >= LUNCH_FROM && g.endMin < LUNCH_TO && inGrid(endStep)) {
      d.lunchCandidates[endStep] += between * (prayerGoer ? 1 - prayerShare : 1);
    }
  }
  if (isFriday) {
    spreadWindow(d.prayerOut, z - 45, z - 15, goers);
    spreadWindow(d.prayerBack, z + 60, z + 90, goers);
  }

  // 5. Shuttle riders
  const riderShare = (1 - bl.residentShare.value) * bl.shuttleShare.value;
  const ff = bl.freeFlowOneWayMin.value;
  for (let t = 0; t < STEPS; t++) {
    d.apuStopArrivals[t] = d.leaving[t] * riderShare;
    if (d.arriving[t] === 0) continue;
    const target = Math.max(0, t - Math.round(ff * (road.ratio[t] ?? 1) / 15));
    d.lrtStopArrivals[target] += d.arriving[t] * riderShare;
  }

  // 6. Intake
  const intakeIds: string[] = [];
  for (const dis of bundle.context.disruptions) {
    if (dis.kind !== 'intake') continue;
    const e = bundle.estimates.find(x => x.key === 'intakeShuttleDemand' && x.disruptionId === dis.id && typeof x.likely === 'number');
    if (!e) continue;
    const x = e.likely as number;
    spreadWindow(d.lrtStopArrivals, 480, 660, x);
    spreadWindow(d.apuStopArrivals, 900, 1080, x);
    intakeIds.push(dis.id);
  }

  // 9. Label and inputs
  const aiUsed = drop !== null || intakeIds.length > 0;
  d.label = weakest(tt.label, bl.attendeesPerSession.label, bl.attendanceRate.label,
    bl.shuttleShare.label, bl.residentShare.label, aiUsed ? 'ai' : null);
  d.inputs = mergeInputs(
    ['timetable', 'baseline:attendeesPerSession', 'baseline:attendanceRate', 'baseline:leaveSpreadMin',
      'baseline:arriveSpreadMin', 'baseline:residentShare', 'baseline:shuttleShare', 'baseline:freeFlowOneWayMin'],
    isFriday ? ['prayer', 'baseline:fridayPrayerShare'] : ['baseline:lunchSpreadMin'],
    drop !== null ? [`estimate:attendanceDrop:${drop.disruptionId}`] : [],
    intakeIds.map(id => `estimate:intakeShuttleDemand:${id}`),
  );
  return d;
}

export function sessionsMovedBySlot(bundle: InputBundle, lever: ClassesOnline): { block: BlockId; startMin: number; count: number }[] {
  const tt = bundle.timetable;
  if (tt === null) return [];
  const slots = new Map<string, { block: BlockId; startMin: number; count: number }>();
  for (const g of placeGroups(tt.groups, [lever])) {
    if (!g.moved) continue;
    const key = `${g.block}|${g.startMin}`;
    const s = slots.get(key);
    if (s) s.count += g.count;
    else slots.set(key, { block: g.block, startMin: g.startMin, count: g.count });
  }
  return [...slots.values()].sort((a, b) =>
    a.startMin - b.startMin || BLOCK_IDS.indexOf(a.block) - BLOCK_IDS.indexOf(b.block));
}
