import { CatmullRomCurve3, Vector3 } from 'three';

/** Shuttle route from the APU stop to the LRT bay (compressed, not to scale). y = 0.05. */
export const ROUTE_POINTS: [number, number, number][] = [
  [16, 0.05, 13], [16, 0.05, 24], [-20, 0.05, 24], [-50, 0.05, 26],
  [-70, 0.05, 18], [-85, 0.05, 8], [-92, 0.05, 6],
];

export const ROAD_SEGMENTS: { zoneId: string; from: number; to: number }[] = [
  { zoneId: 'road-jalan-teknologi', from: 0, to: 0.25 },
  { zoneId: 'road-kl-seremban', from: 0.25, to: 0.55 },
  { zoneId: 'road-bukit-jalil-hwy', from: 0.55, to: 0.85 },
  { zoneId: 'road-jalan-merah-caga', from: 0.85, to: 1 },
];

let cached: CatmullRomCurve3 | null = null;
export function routeCurve(): CatmullRomCurve3 {
  cached ??= new CatmullRomCurve3(ROUTE_POINTS.map(([x, y, z]) => new Vector3(x, y, z)), false, 'centripetal');
  return cached;
}

/** Zone id of the road segment containing curve parameter t (clamped to [0, 1]). */
export function segmentAt(t: number): string {
  const c = Math.min(1, Math.max(0, t));
  const seg = ROAD_SEGMENTS.find((s) => c >= s.from && c < s.to) ?? ROAD_SEGMENTS[ROAD_SEGMENTS.length - 1]!;
  return seg.zoneId;
}
