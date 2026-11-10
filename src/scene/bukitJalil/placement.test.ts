import { describe, expect, it } from 'vitest';
import { SITE } from '../layout.ts';
import { routeCurve } from '../route.ts';
import { Box3, Ray, Vector3 } from 'three';
import { CAMERA_PRESETS } from '../cameraPresets.ts';
import { LRT_BAY, SITE_SCALE, STADIUM_AT, STADIUM_CLEAR_RADIUS, STATION_AT, STATION_BOX, STATION_CLICK_BOXES, siteToScene } from './placement.ts';
import { ENTRANCE, STADIUM, STATION } from './siteLayout.ts';
import { stationToWorld, trackCurve } from './track.ts';

const route = routeCurve().getSpacedPoints(400);

describe('Bukit Jalil placement', () => {
  it('puts the station on its scene anchor and the stadium at the model origin', () => {
    const [x, z] = siteToScene(STATION.x, STATION.z);
    expect(x).toBeCloseTo(STATION_AT[0]);
    expect(z).toBeCloseTo(STATION_AT[1]);
    expect(siteToScene(0, 0)).toEqual([STADIUM_AT[0], STADIUM_AT[1]]);
  });

  it('runs the track along the scene x axis through the station, entrance to the south', () => {
    const along = stationToWorld(50, 0, 0), front = stationToWorld(0, 0, 50);
    const [ax, az] = siteToScene(along.x, along.z), [fx, fz] = siteToScene(front.x, front.z);
    expect(ax).toBeCloseTo(STATION_AT[0] + 10);
    expect(az).toBeCloseTo(STATION_AT[1]);
    expect(fx).toBeCloseTo(STATION_AT[0]);
    expect(fz).toBeCloseTo(STATION_AT[1] + 10);
  });

  it('ends the shuttle route at the bay, on the forecourt just outside the station roof', () => {
    const end = routeCurve().getPoint(1);
    expect(end.x).toBeCloseTo(LRT_BAY[0]);
    expect(end.z).toBeCloseTo(LRT_BAY[1]);
    expect(LRT_BAY[1]).toBeGreaterThan(STATION_BOX.z + STATION_BOX.d / 2);
    expect(Math.abs(LRT_BAY[0] - STATION_BOX.x)).toBeLessThan(STATION_BOX.w / 2);
  });

  it('takes clicks on the entrance canopy and its signboards from the overview camera', () => {
    const eye = new Vector3(...CAMERA_PRESETS.overview.position);
    const volumes = STATION_CLICK_BOXES.map((b) => new Box3(
      new Vector3(b.x - b.w / 2, b.y, b.z - b.d / 2),
      new Vector3(b.x + b.w / 2, b.y + b.h, b.z + b.d / 2),
    ));
    const { fromX, toX, backZ, frontZ, canopyY, signTopY } = ENTRANCE;
    const midX = (fromX + toX) / 2, midZ = (backZ + frontZ) / 2;
    // Station-local metres: the canopy's corners, edges and middle, then the top of the signboards.
    const spots: [number, number, number][] = [
      ...[fromX, midX, toX].flatMap((x) => [backZ, midZ, frontZ].map((z): [number, number, number] => [x, canopyY, z])),
      [fromX, signTopY - 0.2, frontZ - 0.6],
      [midX, signTopY - 0.2, frontZ - 0.6],
    ];
    for (const [lx, ly, lz] of spots) {
      const model = stationToWorld(lx, ly, lz);
      const [x, z] = siteToScene(model.x, model.z);
      const ray = new Ray(eye, new Vector3(x, ly * SITE_SCALE, z).sub(eye).normalize());
      expect(volumes.some((v) => ray.intersectsBox(v)), `canopy point ${lx}, ${ly}, ${lz}`).toBe(true);
    }
  });

  it('keeps the stadium, its apron and the event crowd off the shuttle road', () => {
    const nearest = Math.min(...route.map((p) => Math.hypot(p.x - STADIUM_AT[0], p.z - STADIUM_AT[1])));
    expect(nearest).toBeGreaterThan(STADIUM_CLEAR_RADIUS + 6);
    expect(nearest).toBeGreaterThan((STADIUM.rz + STADIUM.apron) * 0.2 + 2);
  });

  it('keeps the viaduct on the ground plane, clear of the campus and of the shuttle road', () => {
    for (const p of trackCurve.getSpacedPoints(600)) {
      const [x, z] = siteToScene(p.x, p.z);
      expect(x).toBeGreaterThanOrEqual(-245.01);
      expect(z).toBeGreaterThanOrEqual(-85.01);
      // Keep a wide margin on the west side of the site.
      const onCampus = x > SITE.x0 - 16 && x < SITE.x1 && z > SITE.z0 && z < SITE.z1;
      expect(onCampus, `track at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(false);
      expect(Math.min(...route.map((r) => Math.hypot(r.x - x, r.z - z)))).toBeGreaterThan(4);
    }
  });
});
