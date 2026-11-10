/**
 * Layout of the Bukit Jalil model (Stadium Nasional and the LRT station), in the model's own frame.
 *
 * Model frame: +X is east, +Z is south, +Y is up, and one unit is one metre. The origin is the
 * centre spot of the stadium pitch. `placement.ts` puts this frame into the campus scene.
 *
 * Numbers only: this file is imported by the zone list, which loads with the app, so it must not
 * import Three.js. Geometry built from these numbers lives in `track.ts`.
 */

export type XZ = readonly [number, number];

export const STADIUM = {
  /** Façade semi-axis, east–west. */
  rx: 134,
  /** Façade semi-axis, north–south (the pitch's long axis). */
  rz: 150,
  bowlInnerRx: 62,
  bowlInnerRz: 92,
  bowlOuterRx: 126,
  bowlOuterRz: 142,
  roofInnerRx: 60,
  roofInnerRz: 80,
  wallTopY: 40,
  rimY: 42,
  roofInnerY: 46,
  /** Width of the paved apron ringing the façade. */
  apron: 22,
} as const;

export const STATION = {
  x: 70,
  z: -345,
  /** Track axis, measured from +X (east) round towards +Z (south). */
  heading: 40 * (Math.PI / 180),
  /** Roof length along the track. */
  length: 108,
  bay: 12,
  /** Roof half-width at the arch lines. */
  halfWidth: 19,
  eaveY: 13.6,
  crownY: 21.6,
  /** Distance of each blue column row from the track centreline. */
  columnZ: 11.6,
  columnTopY: 14.2,
  platformY: 8.4,
  /** Top of the viaduct deck. */
  deckY: 7.4,
  railY: 7.62,
  /** Lateral offset of each track from the viaduct centreline. */
  trackOffset: 2.25,
} as const;

/** The ground-level entrance canopy on the station's plaza side, in station-local metres (see `LrtStation.tsx`). */
export const ENTRANCE = {
  /** The canopy runs from `fromX` to `toX` along the track. */
  fromX: -46,
  toX: 26,
  backZ: 13.6,
  frontZ: 30.7,
  canopyY: 6.05,
  /** Top of the signboards standing on the canopy's front edge. */
  signTopY: 10.05,
} as const;

/** `rotation.y` that turns the station's local +X onto its track axis. */
export const stationRotationY = -STATION.heading;

export const cosH = Math.cos(STATION.heading);
export const sinH = Math.sin(STATION.heading);

/** Model-frame XZ to station-local [x, z]. */
export function worldToStation(x: number, z: number): XZ {
  const dx = x - STATION.x;
  const dz = z - STATION.z;
  return [dx * cosH + dz * sinH, -dx * sinH + dz * cosH];
}
