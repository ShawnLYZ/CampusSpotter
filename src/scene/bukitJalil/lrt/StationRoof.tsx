import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { STATION } from '../siteLayout.ts';
import { Boxes, Struts, type BoxItem, type Segment } from '../helpers/Instanced.tsx';

const {
  length: LENGTH,
  bay: BAY,
  halfWidth: HALF_WIDTH,
  eaveY: EAVE_Y,
  crownY: CROWN_Y,
  columnZ: COLUMN_Z,
  columnTopY: COLUMN_TOP,
  platformY: PLATFORM_Y,
} = STATION;

const BAYS = LENGTH / BAY;
/** Arch lines, one at each end of every bay. */
const RIB_XS = Array.from({ length: BAYS + 1 }, (_, i) => -LENGTH / 2 + i * BAY);

const ORANGE = '#e0531f';
const COLUMN_BLUE = '#1f55c4';

/** Height of the barrel vault at the arch lines, `z` metres off the track centreline. */
function vaultHeight(z: number): number {
  return CROWN_Y - (CROWN_Y - EAVE_Y) * (z / HALF_WIDTH) ** 2;
}

/** Depth of an arch truss: deepest at the crown, tapering to the eaves. */
function trussDepth(z: number): number {
  return 0.3 + 1.5 * (1 - (z / HALF_WIDTH) ** 2);
}

const topChordY = (z: number) => vaultHeight(z) - 0.35;
const bottomChordY = (z: number) => topChordY(z) - trussDepth(z);

/**
 * The fabric roof: a barrel vault over the tracks, made of one membrane panel
 * per bay. Each panel swells between its arches and its free edge is cut back
 * in a curve, which is what gives the eaves their scalloped outline.
 */
function buildMembrane(): THREE.BufferGeometry {
  const alongSteps = 10;
  const acrossSteps = 24;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let bay = 0; bay < BAYS; bay++) {
    // Vertices aren't shared between bays, so the arch lines stay as creases.
    const base = positions.length / 3;
    for (let iu = 0; iu <= alongSteps; iu++) {
      const f = iu / alongSteps;
      const swell = Math.sin(Math.PI * f);
      const x = -LENGTH / 2 + (bay + f) * BAY;
      const half = HALF_WIDTH - 3.4 * swell ** 0.85;
      for (let iv = 0; iv <= acrossSteps; iv++) {
        const s = -1 + (2 * iv) / acrossSteps;
        const z = s * half;
        positions.push(x, vaultHeight(z) + 0.9 * swell * (1 - 0.35 * s * s), z);
      }
    }
    const row = acrossSteps + 1;
    for (let iu = 0; iu < alongSteps; iu++) {
      for (let iv = 0; iv < acrossSteps; iv++) {
        const a = base + iu * row + iv;
        const b = a + row;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** One arch: a curved lattice truss, plus the raking struts that carry it off the column heads. */
function archSegments(x: number): Segment[] {
  const steps = 14;
  const top: THREE.Vector3Tuple[] = [];
  const bottom: THREE.Vector3Tuple[] = [];
  for (let k = 0; k <= steps; k++) {
    const z = -HALF_WIDTH + (2 * HALF_WIDTH * k) / steps;
    top.push([x, topChordY(z), z]);
    bottom.push([x, bottomChordY(z), z]);
  }
  const segments: Segment[] = [];
  for (let k = 0; k < steps; k++) {
    segments.push([top[k], top[k + 1], 0.2], [bottom[k], bottom[k + 1], 0.17]);
    segments.push(k % 2 === 0 ? [bottom[k], top[k + 1], 0.09] : [top[k], bottom[k + 1], 0.09]);
  }
  for (const side of [-1, 1]) {
    const head: THREE.Vector3Tuple = [x, COLUMN_TOP, side * COLUMN_Z];
    const inner = side * 6.8;
    const outer = side * 17;
    segments.push(
      [head, [x, bottomChordY(inner), inner], 0.2],
      [head, [x, bottomChordY(outer), outer], 0.2],
      [head, [x, bottomChordY(side * COLUMN_Z), side * COLUMN_Z], 0.16],
    );
  }
  return segments;
}

const STEEL: Segment[] = [
  ...RIB_XS.flatMap(archSegments),
  // Longitudinal ties under the crown, over each column row, and along each eave.
  ...[0, -COLUMN_Z, COLUMN_Z, -17, 17].map((z): Segment => [[-LENGTH / 2, bottomChordY(z), z], [LENGTH / 2, bottomChordY(z), z], 0.15]),
];

const COLUMNS: Segment[] = RIB_XS.flatMap((x) =>
  [-COLUMN_Z, COLUMN_Z].map((z): Segment => [
    [x, 0, z],
    [x, COLUMN_TOP, z],
  ]),
);

/** Tall masts off each end of the roof, and the short outriggers that tension every eave point. */
const MAST_X = LENGTH / 2 + 2.6;
const MAST_Z = 7.5;
const MAST_TOP = 31;
const MASTS: Segment[] = [
  ...[-1, 1].flatMap((end) => [-1, 1].map((side): Segment => [[end * MAST_X, PLATFORM_Y + 1, side * MAST_Z], [end * MAST_X, MAST_TOP, side * MAST_Z], 0.22])),
  ...RIB_XS.flatMap((x) => [-1, 1].map((side): Segment => [[x, EAVE_Y - 0.2, side * (HALF_WIDTH - 0.3)], [x, EAVE_Y + 1.7, side * (HALF_WIDTH + 2.4)], 0.09])),
];

/** Cable stays from each mast head down to the roof edge. Consecutive pairs of points are one cable. */
const STAYS: THREE.Vector3Tuple[] = [-1, 1].flatMap((end) =>
  [-1, 1].flatMap((side): THREE.Vector3Tuple[] => {
    const head: THREE.Vector3Tuple = [end * MAST_X, MAST_TOP, side * MAST_Z];
    const ribX = (end * LENGTH) / 2;
    return [
      head,
      [ribX, vaultHeight(0), 0],
      head,
      [ribX, EAVE_Y, side * HALF_WIDTH],
      head,
      [ribX - end * BAY, vaultHeight(side * 9), side * 9],
      head,
      [end * (MAST_X + 7), PLATFORM_Y, side * MAST_Z],
    ];
  }),
);

/** Green louvre screens closing the ends of the platforms, and wrapping one bay down each side. */
const LOUVRES: BoxItem[] = (() => {
  const items: BoxItem[] = [];
  for (const end of [-1, 1]) {
    const x = end * (LENGTH / 2 + 0.3);
    for (const side of [-1, 1]) {
      for (let y = PLATFORM_Y + 1.6; y <= 16.4; y += 0.5) {
        items.push({ p: [x, y, side * 7.9], s: [0.14, 0.3, 6.6] });
      }
      for (let y = PLATFORM_Y + 1.6; y <= 13.2; y += 0.5) {
        items.push({ p: [end * (LENGTH / 2 - BAY / 2), y, side * (COLUMN_Z + 0.5)], s: [BAY - 1.2, 0.3, 0.14] });
      }
    }
  }
  return items;
})();

/** The station's canopy structure: membrane roof, orange arches, blue columns, masts and screens. */
export function StationRoof() {
  const membrane = useMemo(buildMembrane, []);
  return (
    <group>
      <mesh geometry={membrane} castShadow receiveShadow>
        <meshStandardMaterial color="#f4eedc" roughness={0.92} side={THREE.DoubleSide} />
      </mesh>
      <Struts segments={STEEL} color={ORANGE} roughness={0.55} castShadow={false} />
      <Struts segments={COLUMNS} radius={0.55} color={COLUMN_BLUE} roughness={0.5} radialSegments={12} />
      <Struts segments={MASTS} color="#eceeef" castShadow={false} />
      <Line points={STAYS} segments color="#d9dde0" lineWidth={1} />
      <Boxes items={LOUVRES} color="#84b648" roughness={0.7} castShadow={false} />
    </group>
  );
}
