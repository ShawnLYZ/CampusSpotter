import type { BlockId } from '@engine/types.ts';

/** Scene units: 1 unit = 5 m; x east, z south, y up. Height = floors × FLOOR_HEIGHT. */
export const FLOOR_HEIGHT = 0.7;

export type LayoutItem = {
  id: string; kind: string; x: number; z: number;
  w?: number; d?: number; floors?: number; blockId?: BlockId; radius?: number;
};

export const CAMPUS_LAYOUT: LayoutItem[] = [
  { id: 'block-a', kind: 'block', x: -18, z: 6, w: 10, d: 7, floors: 10, blockId: 'A' },
  { id: 'block-b', kind: 'block', x: -5, z: 7, w: 12, d: 8, floors: 7, blockId: 'B' },
  { id: 'atrium', kind: 'atrium', x: 10, z: 8, w: 12, d: 10, floors: 3 },
  { id: 'block-c', kind: 'block', x: -20, z: -8, w: 9, d: 7, floors: 8, blockId: 'C' },
  { id: 'block-d', kind: 'block', x: -7, z: -9, w: 11, d: 7, floors: 8, blockId: 'D' },
  { id: 'block-e', kind: 'block', x: 6, z: -8, w: 10, d: 7, floors: 7, blockId: 'E' },
  { id: 'library', kind: 'library', x: 18, z: -6, w: 7, d: 7, floors: 5, blockId: 'L' },
  { id: 'spine', kind: 'spine', x: 0, z: -1, w: 46, d: 3, blockId: 'S' },
  { id: 'residences-j', kind: 'residence', x: -32, z: -14, w: 6, d: 4, floors: 12 },
  { id: 'residences-k', kind: 'residence', x: 28, z: -16, w: 6, d: 4, floors: 12 },
  { id: 'carpark-a', kind: 'carpark', x: -34, z: 8, w: 10, d: 10, floors: 3 },
  { id: 'carpark-b', kind: 'carpark', x: 0, z: 18, w: 40, d: 6, floors: 0 },
  { id: 'apu-stop', kind: 'stop', x: 16, z: 13 },
  { id: 'canopy', kind: 'canopy', x: 10, z: 8, radius: 9 },
];

export function itemById(id: string): LayoutItem | undefined {
  return CAMPUS_LAYOUT.find((i) => i.id === id);
}
