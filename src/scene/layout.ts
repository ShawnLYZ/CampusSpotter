import type { BlockId } from '@engine/types.ts';

/** Scene units: 1 unit = 5 m; x east, z south, y up. The campus parts are modelled in metres and scaled by `M`. */
export const M = 0.2;
/** One 4 m storey. Wall height = floors × FLOOR_HEIGHT. */
export const FLOOR_HEIGHT = 0.8;
/** The glazed top storey and oversailing roof that sit on top of a block's walls. */
export const PAVILION_HEIGHT = 1.35;
/** Width of one facade bay (a strip window between mullions). */
export const BAY = 0.9;

export type Side = 'n' | 's' | 'e' | 'w';
/** A stretch of one facade as fractions of its length, measured west to east (n, s) or north to south (e, w). */
export type Span = [from: number, to: number];
/** What a building's walls are made of. `strip` (the default) is the academic blocks' white wall with strip windows. */
export type Facade = 'strip' | 'punched' | 'glass' | 'fins' | 'plain';

export type LayoutItem = {
  id: string; kind: string; x: number; z: number;
  w?: number; d?: number; floors?: number; blockId?: BlockId;
  facade?: Facade;
  /** Glazed top storey under an oversailing roof (the academic blocks). */
  pavilion?: boolean;
  /** Stretches of facade that stand behind a metal sun screen. */
  screens?: Partial<Record<Side, Span>>;
  /** Stair and lift cores: white towers with small windows, standing proud of a facade. */
  cores?: Partial<Record<Side, Span[]>>;
  /** Colour of blank east and west end walls (the residences). */
  ends?: string;
  /** A planted flat roof. */
  green?: boolean;
  tint?: string;
};

/**
 * The campus sits between four streets with its entrance atrium on the south-east corner.
 * Academic blocks line the south and east streets, two long bars fill the middle, the sports
 * block steps down to the north-east corner and the residences stand in the north-west.
 */
export const CAMPUS_LAYOUT: LayoutItem[] = [
  // South row, on the frontage.
  { id: 'block-a', kind: 'block', x: -9.6, z: 2.6, w: 8.4, d: 6.4, floors: 8, blockId: 'A', pavilion: true,
    screens: { w: [0.14, 0.86], e: [0.14, 0.86] }, cores: { s: [[0, 0.15], [0.85, 1]] } },
  { id: 'block-b', kind: 'block', x: 2.6, z: 2, w: 9.2, d: 5.6, floors: 8, blockId: 'B', pavilion: true,
    screens: { s: [0.17, 0.85] }, cores: { s: [[0, 0.14]], w: [[0.3, 0.7]] } },
  // The two long bars behind them.
  { id: 'block-d', kind: 'block', x: -1.6, z: -8.6, w: 17.2, d: 5.2, floors: 7, blockId: 'D', pavilion: true,
    cores: { w: [[0.25, 0.75]], n: [[0.46, 0.54]] } },
  { id: 'block-c', kind: 'block', x: -3, z: -15.6, w: 16, d: 5.2, floors: 7, blockId: 'C', pavilion: true,
    cores: { w: [[0.25, 0.75]], e: [[0.25, 0.75]] } },
  // East row: the library beside the atrium, then Block E.
  { id: 'library', kind: 'library', x: 18.4, z: -9.6, w: 8, d: 5.6, floors: 8, blockId: 'L', pavilion: true,
    screens: { e: [0.34, 1] }, cores: { e: [[0, 0.3]] } },
  { id: 'block-e', kind: 'block', x: 17.2, z: -18.6, w: 10.4, d: 6, floors: 8, blockId: 'E', pavilion: true,
    screens: { e: [0.3, 0.94] }, cores: { e: [[0, 0.26]], w: [[0.3, 0.7]] } },
  // Glazed connector from the atrium back to Block E.
  { id: 'link', kind: 'link', x: 10.2, z: -12.4, w: 3.2, d: 13.6, floors: 6, facade: 'glass' },
  // The three-storey podium the bars rise from; its open roof deck is the Spine.
  { id: 'podium', kind: 'podium', x: -2.6, z: -9.45, w: 22.4, d: 17.9, floors: 3, facade: 'fins' },
  { id: 'spine', kind: 'spine', x: -2.25, z: -3.25, w: 21.5, d: 4.6, blockId: 'S' },
  // Entrance atrium: the footprint and height of its canopy.
  { id: 'atrium', kind: 'atrium', x: 16.4, z: 0, w: 17.6, d: 14.6, floors: 9 },
  // Sports and recreation block: three terraces stepping down to the north-east corner.
  { id: 'sports-1', kind: 'sports', x: 17.5, z: -23.5, w: 12, d: 3.8, floors: 6, facade: 'plain', screens: { e: [0.1, 0.9] } },
  { id: 'sports-2', kind: 'sports', x: 17.5, z: -26.6, w: 12, d: 2.4, floors: 4, facade: 'plain', green: true },
  { id: 'sports-3', kind: 'sports', x: 18.3, z: -28.5, w: 10.4, d: 1.4, floors: 2, facade: 'plain', green: true },
  // Residences: four slabs on a shared podium.
  { id: 'residences-j1', kind: 'residence', x: -3.4, z: -21.4, w: 11.6, d: 3.2, floors: 12, facade: 'punched', ends: '#8d9399' },
  { id: 'residences-j2', kind: 'residence', x: -11.2, z: -26.2, w: 11.6, d: 3.2, floors: 12, facade: 'punched', ends: '#8d9399' },
  { id: 'residences-k1', kind: 'residence', x: -16.4, z: -21, w: 6, d: 3.2, floors: 10, facade: 'punched', ends: '#8d9399' },
  { id: 'residences-k2', kind: 'residence', x: 2.4, z: -27, w: 6.4, d: 3.2, floors: 11, facade: 'punched', ends: '#8d9399' },
  { id: 'residence-podium', kind: 'podium', x: -6.9, z: -24.2, w: 25.4, d: 9.2, floors: 2, facade: 'fins', green: true },
  { id: 'carpark-b', kind: 'carpark', x: -4.8, z: 9, w: 30, d: 2.4, floors: 0 },
  { id: 'apu-stop', kind: 'stop', x: 16, z: 13 },
];

/** The paved site between the four streets, in scene units. */
export const SITE = { x0: -22, x1: 25.5, z0: -31.5, z1: 11.4 };

/** The open podium roof between the south row and Block D, where people walk. */
export const SPINE_DECK = { x0: -12.6, x1: 8.2, z: -3.25, y: 3 * FLOOR_HEIGHT };

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

/** Whether the point `at` (0 to 1 along the facade, see `Span`) is behind a sun screen or a core. */
export function facadeCovered(it: LayoutItem, side: Side, at: number): boolean {
  const within = ([from, to]: Span) => at >= from && at <= to;
  const screen = it.screens?.[side];
  return (screen ? within(screen) : false) || (it.cores?.[side]?.some(within) ?? false);
}
