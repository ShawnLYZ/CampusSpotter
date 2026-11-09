import type { BlockId } from '@engine/types.ts';

/** Scene units: 1 unit = 5 m; x east, z south, y up. The campus parts are modelled in metres and scaled by `M`. */
export const M = 0.2;
/** One 4 m storey. Wall height = floors × FLOOR_HEIGHT. */
export const FLOOR_HEIGHT = 0.8;
/** The glazed top storey and oversailing roof that sit on top of a block's walls. */
export const PAVILION_HEIGHT = 1.15;
/** Width of one facade bay (a strip window between mullions). */
export const BAY = 0.9;

export type Side = 'n' | 's' | 'e' | 'w';

export type LayoutItem = {
  id: string; kind: string; x: number; z: number;
  w?: number; d?: number; floors?: number; blockId?: BlockId;
  /** Glazed top storey under an oversailing roof (the academic blocks). */
  pavilion?: boolean;
  /** Facades that carry a metal sun screen. */
  screens?: Side[];
  /** Roof pitch in radians. */
  pitch?: number;
  tint?: string;
};

export const CAMPUS_LAYOUT: LayoutItem[] = [
  // Front row, with sun screens facing the road.
  { id: 'block-a', kind: 'block', x: -6.4, z: 2.4, w: 7.6, d: 5.6, floors: 8, blockId: 'A', pavilion: true, screens: ['s', 'w'], pitch: -0.03 },
  { id: 'block-b', kind: 'block', x: 4.8, z: 2.4, w: 7.2, d: 5.6, floors: 8, blockId: 'B', pavilion: true, screens: ['s'] },
  // Middle row.
  { id: 'block-c', kind: 'block', x: -13.2, z: -4.4, w: 5.2, d: 8.8, floors: 7, blockId: 'C', pavilion: true, screens: ['w'] },
  { id: 'block-d', kind: 'block', x: -4, z: -6.8, w: 8, d: 5.2, floors: 7, blockId: 'D', pavilion: true },
  { id: 'block-e', kind: 'block', x: 5.2, z: -6.8, w: 8, d: 5.2, floors: 8, blockId: 'E', pavilion: true, pitch: -0.03 },
  // Glazed wing behind the atrium.
  { id: 'library', kind: 'library', x: 16.8, z: -7.2, w: 8.8, d: 4.8, floors: 7, blockId: 'L', pavilion: true, pitch: -0.03, tint: '#cfe3e0' },
  { id: 'link', kind: 'link', x: 11, z: -2.8, w: 3.2, d: 8.8, floors: 7, tint: '#dfe6e4' },
  // The three-storey podium the blocks rise from; its open roof deck is the Spine.
  { id: 'podium', kind: 'podium', x: -3.5, z: -5.2, w: 25, d: 9.6, floors: 3, tint: '#e2e2dc' },
  { id: 'spine', kind: 'spine', x: -0.7, z: -2.3, w: 19.4, d: 3.8, blockId: 'S' },
  // Entrance atrium: the footprint and height of its canopy.
  { id: 'atrium', kind: 'atrium', x: 16.4, z: 0.8, w: 16, d: 13.2, floors: 10 },
  // Tall rear blocks.
  { id: 'residences-j', kind: 'residence', x: -10.4, z: -16.4, w: 9.2, d: 3.6, floors: 12, tint: '#c9cbcd' },
  { id: 'residences-k', kind: 'residence', x: 1.2, z: -16.8, w: 8.4, d: 3.6, floors: 11, tint: '#d4d5d2' },
  { id: 'carpark-a', kind: 'carpark', x: -30, z: 2, w: 10, d: 12, floors: 3 },
  { id: 'carpark-b', kind: 'carpark', x: -4.8, z: 9, w: 30, d: 2.4, floors: 0 },
  { id: 'apu-stop', kind: 'stop', x: 16, z: 13 },
];

/** The open podium roof between the front and middle rows, where people walk. */
export const SPINE_DECK = { x0: -10.4, x1: 9, z: -2.3, y: 3 * FLOOR_HEIGHT };

export function itemById(id: string): LayoutItem | undefined {
  return CAMPUS_LAYOUT.find((i) => i.id === id);
}

/** Full height of an item, roof included. */
export function itemHeight(it: LayoutItem): number {
  return (it.floors ?? 0) * FLOOR_HEIGHT + (it.pavilion ? PAVILION_HEIGHT : 0);
}

/** Number of window bays along a facade `length` units long. */
export function facadeBays(length: number): number {
  return Math.max(1, Math.round(length / BAY));
}
