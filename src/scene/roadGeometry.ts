import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { routeCurve } from './route.ts';

export const ROAD_WIDTH = 3;
export const ROAD_TOTAL_SAMPLES = 200;

/** Samples used for a segment covering [from, to] of the route (at least 2 intervals). */
export function ribbonSamples(from: number, to: number): number {
  return Math.max(2, Math.ceil(ROAD_TOTAL_SAMPLES * (to - from)));
}

/** Flat ribbon along the route between curve params from..to. Vertices are (left, right) pairs per sample; normals face +y. */
export function ribbonGeometry(from: number, to: number): BufferGeometry {
  const curve = routeCurve();
  const n = ribbonSamples(from, to);
  const pos: number[] = [];
  const idx: number[] = [];
  const up = new Vector3(0, 1, 0);
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n;
    const p = curve.getPoint(t);
    const side = curve.getTangent(t).cross(up).normalize().multiplyScalar(ROAD_WIDTH / 2);
    pos.push(p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z);
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Line-segment positions (pairs of points) tracing both edges of the ribbon, lifted slightly above it. */
export function ribbonEdgePositions(from: number, to: number, lift = 0.06): Float32Array {
  const curve = routeCurve();
  const n = ribbonSamples(from, to);
  const up = new Vector3(0, 1, 0);
  const left: Vector3[] = [], right: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n;
    const p = curve.getPoint(t);
    const side = curve.getTangent(t).cross(up).normalize().multiplyScalar(ROAD_WIDTH / 2);
    left.push(new Vector3(p.x - side.x, p.y + lift, p.z - side.z));
    right.push(new Vector3(p.x + side.x, p.y + lift, p.z + side.z));
  }
  const out: number[] = [];
  for (const edge of [left, right]) for (let i = 0; i < n; i++) out.push(edge[i].x, edge[i].y, edge[i].z, edge[i + 1].x, edge[i + 1].y, edge[i + 1].z);
  return new Float32Array(out);
}
