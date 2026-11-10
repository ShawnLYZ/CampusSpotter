import { useMemo } from 'react';
import * as THREE from 'three';
import { STATION, worldToStation, type XZ } from '../siteLayout.ts';
import { trackCurve } from '../track.ts';
import { ROAD_X } from './LrtStation.tsx';
import { Boxes, type BoxItem } from '../helpers/Instanced.tsx';
import { sweepGeometry, yawTowards } from '../helpers/geometry.ts';

const { deckY: DECK_Y, railY: RAIL_Y, trackOffset: TRACK_OFFSET } = STATION;

const SOFFIT_Y = DECK_Y - 1.9;
const PIER_SPACING = 30;
const SAMPLE_SPACING = 4;
const GAUGE = 1.435;

/** Box-girder section with upstand parapets, listed clockwise so its faces point outwards. */
const DECK_SECTION: readonly XZ[] = [
  [-4.8, DECK_Y + 0.9],
  [-4.55, DECK_Y + 0.9],
  [-4.55, DECK_Y],
  [4.55, DECK_Y],
  [4.55, DECK_Y + 0.9],
  [4.8, DECK_Y + 0.9],
  [4.8, DECK_Y - 0.5],
  [2.6, SOFFIT_Y],
  [-2.6, SOFFIT_Y],
  [-4.8, DECK_Y - 0.5],
];

const ribbon = (centre: number, width: number, y: number): XZ[] => [
  [centre - width / 2, y],
  [centre + width / 2, y],
];

/** Piers at regular spacing, left out where the station or the road beside it occupies the ground. */
function placePiers(): BoxItem[] {
  const length = trackCurve.getLength();
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const piers: BoxItem[] = [];
  for (let s = PIER_SPACING / 2; s < length; s += PIER_SPACING) {
    trackCurve.getPointAt(s / length, point);
    const [lx, lz] = worldToStation(point.x, point.z);
    if (Math.abs(lx) < STATION.length / 2 + 4 && Math.abs(lz) < 20) continue;
    if (Math.abs(lx - ROAD_X) < 11 && Math.abs(lz) < 20) continue;
    trackCurve.getTangentAt(s / length, tangent);
    const ry = yawTowards(tangent.x, tangent.z);
    piers.push(
      { p: [point.x, (SOFFIT_Y - 1.3) / 2, point.z], s: [2.2, SOFFIT_Y - 1.3, 1.9], ry },
      { p: [point.x, SOFFIT_Y - 0.65, point.z], s: [2.6, 1.3, 6.4], ry },
    );
  }
  return piers;
}

/** The elevated guideway: concrete deck on piers, carrying two tracks. */
export function Viaduct() {
  const { deck, plinths, rails } = useMemo(() => {
    const samples = Math.ceil(trackCurve.getLength() / SAMPLE_SPACING);
    const sweep = (profile: readonly XZ[], closed = false) => sweepGeometry(trackCurve, profile, samples, { closed });
    return {
      deck: sweep(DECK_SECTION, true),
      plinths: [-1, 1].map((side) => sweep(ribbon(side * TRACK_OFFSET, 2.6, DECK_Y + 0.08))),
      rails: [-1, 1].flatMap((side) => [-1, 1].map((rail) => sweep(ribbon(side * TRACK_OFFSET + (rail * GAUGE) / 2, 0.14, RAIL_Y)))),
    };
  }, []);
  const piers = useMemo(placePiers, []);

  return (
    <group>
      <mesh geometry={deck} castShadow receiveShadow>
        <meshStandardMaterial color="#bdbbb4" roughness={0.9} />
      </mesh>
      {plinths.map((geometry, i) => (
        <mesh key={i} geometry={geometry} receiveShadow>
          <meshStandardMaterial color="#8b8c8e" roughness={1} />
        </mesh>
      ))}
      {rails.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial color="#4a4541" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      <Boxes items={piers} color="#b3b1aa" roughness={0.95} />
    </group>
  );
}
