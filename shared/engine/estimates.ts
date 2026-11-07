import type { DisruptionKind, EstimateKey, InputBundle } from './types.ts';

export interface EstimateKeySpec {
  key: EstimateKey; shape: 'curve' | 'scalar'; min: number; max: number; unit: string; title: string;
}

export const ESTIMATE_KEYS: EstimateKeySpec[] = [
  { key: 'eventRoadUplift', shape: 'curve', min: 1, max: 12, unit: 'x free-flow', title: 'Event road uplift' },
  { key: 'eventArrivalCurve', shape: 'curve', min: 0, max: 1, unit: 'share', title: 'Event arrival curve' },
  { key: 'eventDepartureCurve', shape: 'curve', min: 0, max: 1, unit: 'share', title: 'Event departure curve' },
  { key: 'eventLrtModeShare', shape: 'scalar', min: 0, max: 0.8, unit: 'share', title: 'Event LRT mode share' },
  { key: 'attendanceDrop', shape: 'scalar', min: 0, max: 0.9, unit: 'share', title: 'Attendance drop' },
  { key: 'dinnerStayShare', shape: 'scalar', min: 0, max: 1, unit: 'share', title: 'Dinner stay share' },
  { key: 'advisoryCompliance', shape: 'scalar', min: 0, max: 0.9, unit: 'share', title: 'Advisory compliance' },
  { key: 'intakeShuttleDemand', shape: 'scalar', min: 0, max: 3000, unit: 'students', title: 'Intake shuttle demand' },
];

export const EVENT_KINDS: DisruptionKind[] = ['concert', 'sports'];

export function clampEstimate(key: EstimateKey, value: number | number[]): { value: number | number[]; clamped: boolean } {
  const spec = ESTIMATE_KEYS.find(s => s.key === key);
  if (!spec) throw new Error(`unknown estimate key ${key}`);
  const c = (v: number) => Math.min(spec.max, Math.max(spec.min, v));
  if (Array.isArray(value)) {
    if (value.length !== 20) throw new Error(`curve ${key} must have 20 points, got ${value.length}`);
    let out = value.map(c);
    const clamped = out.some((v, i) => v !== value[i]);
    if (key === 'eventArrivalCurve' || key === 'eventDepartureCurve') {
      const sum = out.reduce((a, b) => a + b, 0);
      if (sum > 0) out = out.map(v => v / sum);
    }
    return { value: out, clamped };
  }
  const v = c(value);
  return { value: v, clamped: v !== value };
}

function matching(bundle: InputBundle, key: EstimateKey, kinds?: DisruptionKind[]) {
  const ids = new Set(bundle.context.disruptions.filter(d => !kinds || kinds.includes(d.kind)).map(d => d.id));
  return bundle.estimates.filter(e => e.key === key && ids.has(e.disruptionId));
}

export function estimateScalar(bundle: InputBundle, key: EstimateKey, kinds?: DisruptionKind[]): { value: number; disruptionId: string } | null {
  let best: { value: number; disruptionId: string } | null = null;
  for (const e of matching(bundle, key, kinds)) {
    if (typeof e.likely !== 'number') continue;
    if (best === null || e.likely > best.value) best = { value: e.likely, disruptionId: e.disruptionId };
  }
  return best;
}

export function estimateCurves(bundle: InputBundle, key: EstimateKey, kinds?: DisruptionKind[]): { curve: number[]; disruptionId: string }[] {
  const out: { curve: number[]; disruptionId: string }[] = [];
  for (const e of matching(bundle, key, kinds)) {
    if (Array.isArray(e.likely)) out.push({ curve: e.likely, disruptionId: e.disruptionId });
  }
  return out;
}
