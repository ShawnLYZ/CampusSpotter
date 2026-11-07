import type { ThreeEvent } from '@react-three/fiber';

export const WHITE = '#f2f2ee';
export const GREY = '#d9dbd6';
export const LINE = '#c9ccc6';
export const GREEN_ROOF = '#5f9a5a';

export type ZoneClick = (zoneId: string) => void;

/** Click handler that reports `zoneId` and stops the event reaching zones (or the ground) behind. The click ending an orbit drag is not reported. */
export function zoneClick(onZoneClick: ZoneClick | undefined, zoneId: string) {
  return (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta <= 2) onZoneClick?.(zoneId); };
}

/** Perimeter line segments of a w by d rectangle at every `step` in y up to `height`, pushed out by `eps`. */
export function floorLinePositions(w: number, d: number, height: number, step: number, eps = 0.02): Float32Array {
  const hx = w / 2 + eps, hz = d / 2 + eps;
  const out: number[] = [];
  for (let y = step; y < height - 1e-6; y += step) {
    out.push(-hx, y, -hz, hx, y, -hz, hx, y, -hz, hx, y, hz, hx, y, hz, -hx, y, hz, -hx, y, hz, -hx, y, -hz);
  }
  return new Float32Array(out);
}

export const ROAD = '#2a2f36';
export const LANE = '#ffffff';
export const GROUND = '#10151c';
export const GRID = '#1a212b';
