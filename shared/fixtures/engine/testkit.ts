import type {
  Baseline, BlockId, DayType, DisruptionRef, Estimate, InputBundle, Label, Labeled, RoadSeries, RoomCounts, SessionGroup, ShuttleDay,
} from '../../engine/types.ts';
import { BLOCK_IDS } from '../../engine/types.ts';
import { HOURLY_POINTS, STEPS } from '../../engine/grid.ts';

export function lab<T>(value: T, label: Label = 'baseline', sourceId: string = 'test'): Labeled<T> {
  return { value, label, sourceId };
}

export interface MakeBundleOptions {
  date?: string; dayType?: DayType; groups?: SessionGroup[];
  conditioned?: Partial<Record<BlockId, RoomCounts[]>>;
  roadRatio?: number | (number | null)[]; roadKind?: RoadSeries['kind'];
  shuttle?: Partial<ShuttleDay>; disruptions?: DisruptionRef[]; estimates?: Estimate[];
  weatherMm?: (number | null)[] | null; zuhrMin?: number | null;
  ridership?: { boardings: number; alightings: number } | null;
  baseline?: Partial<Record<keyof Baseline, number>>;
}

const zeroCounts = (): RoomCounts => ({ classroom: 0, lab: 0, auditorium: 0 });

/** Pure, synchronous deep copy of `base` with the options applied. */
export function makeBundle(base: InputBundle, opts: MakeBundleOptions = {}): InputBundle {
  const b = structuredClone(base);
  if (opts.date !== undefined) {
    b.context.date = opts.date;
    if (b.timetable) b.timetable.date = opts.date;
  }
  if (opts.dayType !== undefined) b.context.dayType = opts.dayType;
  if (opts.groups !== undefined && b.timetable) {
    b.timetable.groups = structuredClone(opts.groups);
    const cond = {} as Record<BlockId, RoomCounts[]>;
    for (const id of BLOCK_IDS) cond[id] = Array.from({ length: STEPS }, zeroCounts);
    b.timetable.conditioned = cond;
  }
  if (opts.conditioned && b.timetable) {
    for (const [id, arr] of Object.entries(opts.conditioned)) b.timetable.conditioned[id as BlockId] = structuredClone(arr);
  }
  if (opts.roadRatio !== undefined) {
    const r = opts.roadRatio;
    b.road.ratio = Array.from({ length: HOURLY_POINTS }, (_, i) => {
      const v = typeof r === 'number' ? r : (r[i] ?? null);
      return v === null ? null : lab(v, 'verified');
    });
  }
  if (opts.roadKind !== undefined) b.road.kind = opts.roadKind;
  if (opts.shuttle) b.shuttle = { ...b.shuttle, ...structuredClone(opts.shuttle) };
  if (opts.disruptions) b.context.disruptions = structuredClone(opts.disruptions);
  if (opts.estimates) b.estimates = structuredClone(opts.estimates);
  if (opts.weatherMm !== undefined) {
    const mm = opts.weatherMm;
    if (mm === null) b.weather = null;
    else {
      b.weather = {
        precipitationMm: Array.from({ length: HOURLY_POINTS }, (_, i) => {
          const v = mm[i] ?? null;
          return v === null ? null : lab(v);
        }),
        probabilityPct: b.weather?.probabilityPct ?? Array.from({ length: HOURLY_POINTS }, () => null),
      };
    }
  }
  if (opts.zuhrMin !== undefined) {
    b.prayer = opts.zuhrMin === null ? null : { date: b.context.date, zuhrMin: lab(opts.zuhrMin) };
  }
  if (opts.ridership !== undefined) {
    b.ridership = opts.ridership === null ? null
      : { typicalDailyBoardings: lab(opts.ridership.boardings), typicalDailyAlightings: lab(opts.ridership.alightings) };
  }
  if (opts.baseline) {
    for (const [k, v] of Object.entries(opts.baseline)) {
      (b.baseline[k as keyof Baseline] as Labeled<number>).value = v;
    }
  }
  return b;
}
