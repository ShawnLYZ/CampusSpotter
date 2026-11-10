import type { ThreeEvent } from '@react-three/fiber';

export const WHITE = '#f2f2ee';
export const GREY = '#d9dbd6';
export const GREEN_ROOF = '#5f9a5a';

export type ZoneClick = (zoneId: string) => void;

/** Click handler that reports `zoneId` and stops the event reaching zones (or the ground) behind. The click ending an orbit drag is not reported. */
export function zoneClick(onZoneClick: ZoneClick | undefined, zoneId: string) {
  return (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta <= 2) onZoneClick?.(zoneId); };
}

export const ROAD = '#2a2f36';
export const LANE = '#ffffff';
export const GROUND = '#10151c';
export const GRID = '#1a212b';
