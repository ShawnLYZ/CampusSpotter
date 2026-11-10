import { M } from '../layout.ts';
import { ENTRANCE, STADIUM, STATION } from './siteLayout.ts';

/*
 * Where the Bukit Jalil model sits in the campus scene. The model is built in metres with the stadium
 * at its origin (see siteLayout.ts); the scene uses 1 unit = 5 m.
 *
 * The station is the fixed point: the shuttle route (route.ts) ends at its forecourt. The model is
 * turned so the track runs along the scene's x axis and the station entrance faces south, which puts
 * the stadium to the station's south-east, at its true distance.
 */

/** Scene [x, z] of the ground under the middle of the station platforms. */
export const STATION_AT: readonly [number, number] = [-100, 0];

/** Scene [x, z] where the shuttle pulls in: the end of the route in route.ts, on the station forecourt. */
export const LRT_BAY: readonly [number, number] = [-92, 6];

export const SITE_SCALE = M;
/** Cancels the station's own heading. */
export const SITE_ROTATION_Y = STATION.heading;

const cos = Math.cos(SITE_ROTATION_Y);
const sin = Math.sin(SITE_ROTATION_Y);
const turn = (x: number, z: number): [number, number] => [x * cos + z * sin, -x * sin + z * cos];

const [stationDx, stationDz] = turn(STATION.x, STATION.z);

/** Scene [x, z] of the model's origin, which is the centre spot of the stadium pitch. */
export const STADIUM_AT: readonly [number, number] = [STATION_AT[0] - stationDx * SITE_SCALE, STATION_AT[1] - stationDz * SITE_SCALE];

/** Model-frame ground point (metres) to scene [x, z]. */
export function siteToScene(x: number, z: number): [number, number] {
  const [tx, tz] = turn(x, z);
  return [STADIUM_AT[0] + tx * SITE_SCALE, STADIUM_AT[1] + tz * SITE_SCALE];
}

/** Scene radius of a circle that clears the stadium, its gates and its outside stairs. */
export const STADIUM_CLEAR_RADIUS = (STADIUM.rz + 10) * SITE_SCALE;
/** Scene height of the stadium roof and of the station roof's crown. */
export const STADIUM_HEIGHT = 50 * SITE_SCALE;
export const STATION_HEIGHT = (STATION.crownY + 1) * SITE_SCALE;

/** Footprint of the station roof in the scene (axis-aligned, because of `SITE_ROTATION_Y`). */
export const STATION_BOX = {
  x: STATION_AT[0], y: 0, z: STATION_AT[1],
  w: (STATION.length + 8) * SITE_SCALE, d: (STATION.halfWidth * 2 + 6) * SITE_SCALE, h: STATION_HEIGHT,
};

/** A metre or two of slack round the entrance canopy, so its overhanging roof slab is covered. */
const ENTRANCE_SLACK = 2;

/** The entrance canopy and its signboards, which stand south of the roof's footprint. Station-local axes match the scene's. */
const ENTRANCE_BOX = {
  x: STATION_AT[0] + ((ENTRANCE.fromX + ENTRANCE.toX) / 2) * SITE_SCALE, y: 0,
  z: STATION_AT[1] + ((ENTRANCE.backZ + ENTRANCE.frontZ + ENTRANCE_SLACK) / 2) * SITE_SCALE,
  w: (ENTRANCE.toX - ENTRANCE.fromX + ENTRANCE_SLACK * 2) * SITE_SCALE,
  d: (ENTRANCE.frontZ + ENTRANCE_SLACK - ENTRANCE.backZ) * SITE_SCALE,
  h: (ENTRANCE.signTopY + 0.5) * SITE_SCALE,
};

/** Invisible volumes that take clicks for the LRT station zone: the roofed station and its entrance. */
export const STATION_CLICK_BOXES = [STATION_BOX, ENTRANCE_BOX];
