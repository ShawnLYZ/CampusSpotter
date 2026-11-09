import type { BlockId, MetricId } from '@engine/types.ts';
import type { Forecast, Pressure, StepStatus, StepValue } from '@engine/output.ts';
import { SPINE_DECK, itemById, itemHeight } from './layout.ts';

/** `detailOnly` metrics are listed in the zone's details but don't set its colour or label. */
export interface MetricRef { metric: MetricId; scope: 'campus' | BlockId; detailOnly?: true }
export interface Zone {
  id: string; name: string; metrics: MetricRef[];
  anchor: [number, number, number]; outline: 'box' | 'path' | 'circle';
}

const topAnchor = (id: string): [number, number, number] => {
  const it = itemById(id)!;
  return [it.x, itemHeight(it), it.z];
};

const block = (letter: BlockId, id: string): Zone => ({
  id, name: `Block ${letter}`, outline: 'box', anchor: topAnchor(id),
  metrics: [{ metric: 'classroomOccupancy', scope: letter }, { metric: 'buildingEnergy', scope: letter }],
});

const road = (id: string, name: string, anchor: [number, number, number]): Zone => ({
  id, name, outline: 'path', anchor, metrics: [{ metric: 'roadDelay', scope: 'campus' }],
});

export const ZONES: Zone[] = [
  block('A', 'block-a'), block('B', 'block-b'), block('C', 'block-c'), block('D', 'block-d'), block('E', 'block-e'),
  {
    id: 'spine', name: 'The Spine', outline: 'box', anchor: [(SPINE_DECK.x0 + SPINE_DECK.x1) / 2, SPINE_DECK.y, SPINE_DECK.z],
    metrics: [{ metric: 'walkwayTraffic', scope: 'campus' }, { metric: 'classroomOccupancy', scope: 'S' }],
  },
  {
    id: 'library', name: 'Library', outline: 'box', anchor: topAnchor('library'),
    metrics: [{ metric: 'classroomOccupancy', scope: 'L' }, { metric: 'buildingEnergy', scope: 'L' }],
  },
  {
    id: 'atrium', name: 'Centre Point & Atrium (cafeteria)', outline: 'circle', anchor: topAnchor('atrium'),
    metrics: [{ metric: 'cafeteriaQueue', scope: 'campus' }],
  },
  {
    id: 'apu-stop', name: 'APU shuttle stop', outline: 'circle', anchor: [16, 5, 13],
    // Coloured by the queue alone: a jammed road already shows red on the road segments.
    metrics: [{ metric: 'apuStopQueue', scope: 'campus' }, { metric: 'shuttleRtt', scope: 'campus', detailOnly: true }],
  },
  { id: 'residences', name: 'Residences J1/J2/K1/K2', outline: 'box', anchor: topAnchor('residences-j'), metrics: [] },
  { id: 'carpark-a', name: 'Car park Zone A (1,130 covered bays)', outline: 'box', anchor: [-30, 2.1, 2], metrics: [] },
  { id: 'carpark-b', name: 'Car park Zone B (558 open bays)', outline: 'box', anchor: [-4.8, 0, 9], metrics: [] },
  road('road-jalan-teknologi', 'Jalan Teknologi', [16, 0, 18]),
  road('road-kl-seremban', 'KL–Seremban Expressway', [-20, 0, 24]),
  road('road-bukit-jalil-hwy', 'Bukit Jalil Highway / Jalan Barat', [-70, 0, 18]),
  road('road-jalan-merah-caga', 'Jalan Merah Caga', [-88, 0, 7]),
  {
    id: 'lrt-station', name: 'LRT Bukit Jalil', outline: 'box', anchor: [-100, 0, 0],
    metrics: [{ metric: 'lrtStopQueue', scope: 'campus' }, { metric: 'lrtCrowding', scope: 'campus' }],
  },
  { id: 'stadium', name: 'TM Stadium Nasional', outline: 'circle', anchor: [-105, 0, 40], metrics: [] },
  { id: 'mranti-parking', name: 'MRANTI Park concert parking', outline: 'box', anchor: [45, 0, 30], metrics: [] },
];

const RANK: Record<Pressure, number> = { green: 0, amber: 1, red: 2 };

export function valueFor(ref: MetricRef, f: Forecast, step: number): StepValue | undefined {
  if (ref.scope === 'campus') return f.metrics[ref.metric]?.steps[step];
  const pb = f.perBlock[ref.scope];
  if (ref.metric === 'classroomOccupancy') return pb?.occupancy[step];
  if (ref.metric === 'buildingEnergy') return pb?.energy[step];
  return undefined;
}

export function zonePressure(zone: Zone, forecast: Forecast, step: number):
  { pressure: Pressure | null; status: StepStatus; worst: MetricRef | null } {
  const refs = zone.metrics.filter((m) => !m.detailOnly);
  if (refs.length === 0) return { pressure: null, status: 'ok', worst: null };
  let pressure: Pressure | null = null;
  let worst: MetricRef | null = null;
  let anyNoData = false;
  let allNoService = true;
  for (const ref of refs) {
    const v = valueFor(ref, forecast, step);
    // A missing value degrades to not_enough_data instead of crashing; zones.test.ts proves the real lookups resolve.
    if (!v || v.status === 'not_enough_data') { anyNoData = true; allNoService = false; continue; }
    if (v.status === 'no_service') continue;
    allNoService = false;
    if (v.pressure && (pressure === null || RANK[v.pressure] > RANK[pressure])) { pressure = v.pressure; worst = ref; }
  }
  if (allNoService) return { pressure: null, status: 'no_service', worst: null };
  if (pressure === null && anyNoData) return { pressure: null, status: 'not_enough_data', worst: null };
  return { pressure, status: 'ok', worst };
}
