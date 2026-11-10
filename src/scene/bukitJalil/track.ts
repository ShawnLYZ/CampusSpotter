import * as THREE from 'three';
import { STATION, cosH, sinH, type XZ } from './siteLayout.ts';

/* The viaduct centreline and the Three.js helpers built on siteLayout.ts. Loaded only with the 3D canvas. */

/**
 * Station-local to model frame. Local +X runs along the track, local +Z points at the entrance plaza.
 */
export function stationToWorld(lx: number, ly: number, lz: number): THREE.Vector3 {
  return new THREE.Vector3(STATION.x + lx * cosH - lz * sinH, ly, STATION.z + lx * sinH + lz * cosH);
}

/** Where the viaduct stops at each end, in station-local metres. Both ends meet an edge of the scene's ground plane. */
export const TRACK_START_X = -725;
export const TRACK_END_Z = -425;

/**
 * Viaduct centreline, as station-local [x, z]. Dead straight through the station (the collinear
 * control points guarantee it), then swinging away behind the station so it stays clear of the campus.
 */
const TRACK_POINTS: readonly XZ[] = [
  ...[TRACK_START_X, -600, -430, -300, -200, -120, -55, 0, 40, 70, 110].map((x): XZ => [x, 0]),
  [160, -6],
  [205, -28],
  [240, -65],
  [262, -115],
  [275, -175],
  [282, -250],
  [285, -340],
  [285, TRACK_END_Z],
];

export const trackCurve = (() => {
  const curve = new THREE.CatmullRomCurve3(TRACK_POINTS.map(([lx, lz]) => stationToWorld(lx, 0, lz)), false, 'centripetal');
  curve.arcLengthDivisions = 1500;
  return curve;
})();

/** Arc length along `curve` of the point nearest to `target`. */
export function arcLengthNearest(curve: THREE.Curve<THREE.Vector3>, target: THREE.Vector3): number {
  const steps = 4000;
  const point = new THREE.Vector3();
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i <= steps; i++) {
    curve.getPointAt(i / steps, point);
    const distance = point.distanceToSquared(target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i / steps;
    }
  }
  return best * curve.getLength();
}
