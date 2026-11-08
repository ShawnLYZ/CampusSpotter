import { validateLevers } from './engine.ts';
import type { InputBundle, Lever, LeverSet, Warning } from './engine.ts';

const BLOCK_IDS = ['A', 'B', 'C', 'D', 'E', 'S', 'L', 'U'];

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isBlocks = (v: unknown): boolean =>
  v === 'all' || (Array.isArray(v) && v.every((b) => isStr(b) && BLOCK_IDS.includes(b)));
const isShifts = (v: unknown): boolean =>
  v !== null && typeof v === 'object' && !Array.isArray(v) &&
  Object.entries(v as Record<string, unknown>).every(([k, s]) => BLOCK_IDS.includes(k) && isNum(s));

/** Per-kind required-field and type checks, as the P1 Lever union requires them. */
const CHECKS: Record<string, (o: Record<string, unknown>) => boolean> = {
  classesOnline: (o) => isNum(o.fromMin) && isNum(o.toMin) && isBlocks(o.blocks),
  stagger: (o) => (o.target === 'end' || o.target === 'start') && isNum(o.fromMin) && isNum(o.toMin) && isShifts(o.shifts),
  extraBuses: (o) => isNum(o.buses) && isNum(o.fromMin) && isNum(o.toMin),
  nonstopLoop: (o) => isNum(o.fromMin) && isNum(o.toMin),
  busesAtLrt: (o) => isNum(o.buses) && isNum(o.atMin),
  cafeteria: (o) =>
    isStr(o.outletId) && isNum(o.extraCounters) && isNum(o.fromMin) && isNum(o.toMin) &&
    (o.closeAtMin === null || isNum(o.closeAtMin)),
  waitingHall: (o) => isStr(o.hallId) && isNum(o.fromMin) && isNum(o.toMin),
  acOffInGap: (o) => isNum(o.fromMin) && isNum(o.toMin) && isBlocks(o.blocks),
  advisory: (o) =>
    isNum(o.advisedMin) && (o.message === 'leave_before' || o.message === 'walk_to_lrt' || o.message === 'expect_delays'),
  studentCount: (o) => isNum(o.percent),
};

/** Convert Gemini wire shapes (blocks list, shifts list, missing closeAtMin) to the engine Lever shape. Null means malformed. */
function toEngineShape(o: Record<string, unknown>): Record<string, unknown> | null {
  const out = { ...o };
  if ('blocks' in out && Array.isArray(out.blocks)) {
    if (out.blocks.includes('all')) out.blocks = 'all';
    else if (out.blocks.length === 0) delete out.blocks;
  }
  if (Array.isArray(out.shifts)) {
    const rec: Record<string, number> = {};
    for (const e of out.shifts) {
      if (e === null || typeof e !== 'object' || Array.isArray(e)) return null;
      const { block, minutes } = e as Record<string, unknown>;
      if (!isStr(block) || !BLOCK_IDS.includes(block) || !isNum(minutes)) return null;
      rec[block] = minutes;
    }
    if (Object.keys(rec).length === 0) return null;
    out.shifts = rec;
  }
  if (out.kind === 'cafeteria' && out.closeAtMin === undefined) out.closeAtMin = null;
  return out;
}

/** Inverse of toEngineShape: the wire shape Gemini sees and returns (blocks list, shifts list, closeAtMin omitted when null). */
export function toWireShape(lever: Lever): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(lever as unknown as Record<string, unknown>) };
  if (out.blocks === 'all') out.blocks = ['all'];
  if (out.shifts !== null && typeof out.shifts === 'object' && !Array.isArray(out.shifts)) {
    out.shifts = Object.entries(out.shifts as Record<string, number>).map(([block, minutes]) => ({ block, minutes }));
  }
  if (out.kind === 'cafeteria' && out.closeAtMin === null) delete out.closeAtMin;
  return out;
}

/** Keys that belong to each kind (per the Lever union); anything else Gemini emits is stripped. */
const KEYS: Record<string, string[]> = {
  classesOnline: ['fromMin', 'toMin', 'blocks'],
  stagger: ['target', 'fromMin', 'toMin', 'shifts'],
  extraBuses: ['buses', 'fromMin', 'toMin'],
  nonstopLoop: ['fromMin', 'toMin'],
  busesAtLrt: ['buses', 'atMin'],
  cafeteria: ['outletId', 'extraCounters', 'fromMin', 'toMin', 'closeAtMin'],
  waitingHall: ['hallId', 'fromMin', 'toMin'],
  acOffInGap: ['fromMin', 'toMin', 'blocks'],
  advisory: ['advisedMin', 'message'],
  studentCount: ['percent'],
};
const pickKeys = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries([['kind', o.kind], ...KEYS[o.kind as string].filter((k) => k in o).map((k) => [k, o[k]])]);

/** Flattens the by-kind wire set ({ extraBuses: [{...}], ... }) to a lever list; a list passes through. Non-list values become one bad entry. */
function flattenLeverSet(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw === null || typeof raw !== 'object') return [raw];
  return Object.entries(raw as Record<string, unknown>).flatMap(([kind, list]) =>
    Array.isArray(list)
      ? list.map((l) => (l !== null && typeof l === 'object' && !Array.isArray(l) ? { ...(l as object), kind } : null))
      : [null]);
}

/** Groups levers by kind in wire shape: the form Gemini sees and returns. */
export function toWireSet(levers: LeverSet): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const l of levers) {
    const { kind, ...rest } = toWireShape(l);
    (out[kind as string] ??= []).push(rest);
  }
  return out;
}

export function coerceLevers(
  raw: unknown,
  bundle: InputBundle,
): { levers: LeverSet; dropped: number; warnings: Warning[] } {
  const kept: Lever[] = [];
  let dropped = 0;
  for (const item of flattenLeverSet(raw)) {
    const o = item !== null && typeof item === 'object' && !Array.isArray(item)
      ? item as Record<string, unknown>
      : null;
    const w = o ? toEngineShape(o) : null;
    const check = w && isStr(w.kind) && Object.hasOwn(CHECKS, w.kind) ? CHECKS[w.kind] : null;
    if (w && check && check(w)) kept.push(pickKeys(w) as unknown as Lever);
    else dropped++;
  }
  const { levers, warnings } = validateLevers(kept, bundle);
  const engineDrops = warnings.filter((w) => w.code === 'lever_dropped').length;
  return { levers, dropped: dropped + engineDrops, warnings };
}

export function leverCatalogueText(bundle: InputBundle): string {
  const b = bundle.baseline;
  const s = bundle.settings;
  return [
    'Lever catalogue. Return levers as an object keyed by kind; each value is a list of levers of that kind with the fields shown (e.g. {"extraBuses": [{"buses": 2, "fromMin": 960, "toMin": 1140}]}). Times are minutes after midnight, integer 420..1560. blocks is a list of block ids, or ["all"] for every block.',
    '- classesOnline {fromMin, toMin, blocks}: moves sessions in the window online. Cost RM 0 (learning disruption is reported).',
    '- stagger {target: "end"|"start", fromMin, toMin, shifts: list of {block: blockId, minutes: 0..30}}: shifts class end or start times per block. Cost RM 0.',
    `- extraBuses {buses: integer 1..10, fromMin, toMin}: hired buses. Cost per bus: window up to 4 h = half-day rate RM ${s.busHalfDayRm.value}; up to 8 h = full-day rate RM ${s.busFullDayRm.value}; over 8 h = full-day plus half-day rates.`,
    '- nonstopLoop {fromMin, toMin}: existing fleet runs a nonstop loop. Cost RM 0.',
    `- busesAtLrt {buses: integer 1..${Math.max(1, b.fleetSize.value)}, atMin}: existing buses wait at LRT Bukit Jalil from atMin. Cost RM 0.`,
    `- cafeteria {outletId, extraCounters: integer 0..10, fromMin, toMin, closeAtMin: optional integer minute, omit for normal closing; never 0}: opens extra counters and/or keeps the outlet open later. Cost: extraCounters x ${s.staffPerCounter.value} staff x hours x RM ${s.staffRatePerHourRm.value}/h, plus the outlet's staff x hours past its normal closing time (closeAtMin; omit closeAtMin to keep normal closing) x the same hourly rate.`,
    '- waitingHall {hallId, fromMin, toMin}: opens an air-conditioned waiting hall. Cost: electricity at the TNB time-of-use tariff for the hall load over the window.',
    '- acOffInGap {fromMin, toMin, blocks}: switches AC and lights off in empty rooms. Cost is negative (net kWh saved x tariff).',
    '- advisory {advisedMin, message: "leave_before"|"walk_to_lrt"|"expect_delays"}: student advisory. Cost RM 0.',
    '- studentCount {percent: integer -30..50}: scales the student population. Cost RM 0; use only for what-if questions.',
    `Block ids: ${BLOCK_IDS.join(', ')}`,
    `Cafeteria outlet ids: ${b.cafeterias.map((c) => c.id).join(', ')}`,
    `Waiting hall ids: ${b.waitingHalls.map((h) => h.id).join(', ')}`,
  ].join('\n');
}
