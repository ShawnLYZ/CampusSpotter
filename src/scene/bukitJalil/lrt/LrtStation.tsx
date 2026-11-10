import { useMemo } from 'react';
import * as THREE from 'three';
import { ENTRANCE, STATION, stationRotationY, type XZ } from '../siteLayout.ts';
import { Boxes, Struts, type BoxItem, type Segment } from '../helpers/Instanced.tsx';
import { flatShapeGeometry } from '../helpers/geometry.ts';
import { Sign } from '../helpers/Sign.tsx';
import { Palms } from './Palms.tsx';
import { Car } from './Vehicles.tsx';
import { StationRoof } from './StationRoof.tsx';

/*
 * Everything here is in the station's own frame: +X runs along the track
 * towards the south-east, +Z points at the entrance plaza, and the origin is
 * on the ground under the middle of the platforms.
 */

const { length: LENGTH, bay: BAY, columnZ: COLUMN_Z, platformY: PLATFORM_Y } = STATION;

const CONCRETE = '#c4c2bb';
const ORANGE = '#e0531f';

const PLATFORM_LENGTH = 94;

/** Side platforms either side of the tracks, with the white planter trays that edge them. */
const PLATFORMS: BoxItem[] = [-1, 1].flatMap((side): BoxItem[] => [
  { p: [0, PLATFORM_Y - 0.3, side * 7.3], s: [PLATFORM_LENGTH, 0.6, 6.8], c: CONCRETE },
  { p: [0, PLATFORM_Y + 0.02, side * 4.5], s: [PLATFORM_LENGTH, 0.04, 0.45], c: '#e6c02c' },
  { p: [0, PLATFORM_Y + 0.3, side * (COLUMN_Z - 0.2)], s: [PLATFORM_LENGTH + 4, 1.8, 1.4], c: '#f0efea' },
  { p: [0, PLATFORM_Y + 1.25, side * (COLUMN_Z - 0.2)], s: [PLATFORM_LENGTH + 3, 0.25, 1.0], c: '#4f8a3a' },
]);

/** Cross-beams at every column pair, and the enclosed concourse tucked beneath the platforms. */
const SUBSTRUCTURE: BoxItem[] = [
  ...Array.from({ length: LENGTH / BAY + 1 }, (_, i): BoxItem => ({
    p: [-LENGTH / 2 + i * BAY, PLATFORM_Y - 1.4, 0],
    s: [1.3, 1.1, COLUMN_Z * 2 + 0.6],
    c: CONCRETE,
  })),
  { p: [0, 3.4, 0], s: [88, 6.8, 21], c: '#85888c' },
];

interface FlightProps {
  position: THREE.Vector3Tuple;
  /** Direction the flight climbs in, as a rotation about the vertical. 0 climbs towards +X. */
  rotationY?: number;
}

const FLIGHT_RUN = 18;
const FLIGHT_LENGTH = Math.hypot(FLIGHT_RUN, PLATFORM_Y);
const FLIGHT_PITCH = Math.atan2(PLATFORM_Y, FLIGHT_RUN);

/** A white staircase from the ground up to platform level, with solid balustrades. */
function Flight({ position, rotationY = 0 }: FlightProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={[0, PLATFORM_Y / 2, 0]} rotation={[0, 0, FLIGHT_PITCH]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[FLIGHT_LENGTH, 0.45, 2.4]} />
          <meshStandardMaterial color="#e9e8e3" roughness={0.85} />
        </mesh>
        {[-1.2, 1.2].map((z) => (
          <mesh key={z} position={[0, 0.75, z]} castShadow>
            <boxGeometry args={[FLIGHT_LENGTH, 1.1, 0.16]} />
            <meshStandardMaterial color="#f4f3ef" roughness={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- entrance */

/** The long ground-level canopy runs from CANOPY_START to CANOPY_END along the track. */
const { fromX: CANOPY_START, toX: CANOPY_END, backZ: CANOPY_BACK, frontZ: CANOPY_FRONT, canopyY: CANOPY_Y } = ENTRANCE;
const CANOPY_MID = (CANOPY_START + CANOPY_END) / 2;
const CANOPY_SPAN = CANOPY_END - CANOPY_START;
const COLONNADE_Z = 17.2;
const CANOPY_COLUMN_XS = Array.from({ length: CANOPY_SPAN / BAY + 1 }, (_, i) => CANOPY_START + i * BAY);

/** The row of brightly painted shopfronts and ticket-hall openings, as [from, to, colour]. */
const SHOPFRONTS: readonly (readonly [number, number, string])[] = [
  [-46, -34, '#e25a2c'],
  [-34, -24, '#cf3a2a'],
  [-24, -10, '#efb32b'],
  [-10, 4, '#8a1c3a'],
  [4, 16, '#2c6fd1'],
  [16, 26, '#6aa83a'],
];

const ENTRANCE_BOXES: BoxItem[] = [
  { p: [CANOPY_MID, CANOPY_Y + 0.4, 22.2], s: [CANOPY_SPAN + 2, 0.2, CANOPY_FRONT - CANOPY_BACK + 0.6], c: '#5c6067' },
  { p: [CANOPY_MID, CANOPY_Y + 0.2, 22.2], s: [CANOPY_SPAN + 1.6, 0.2, CANOPY_FRONT - CANOPY_BACK + 0.2], c: '#d9d2bf' },
  { p: [CANOPY_MID, 3.1, 13.2], s: [CANOPY_SPAN, 6.2, 0.4], c: '#8a8d91' },
  ...SHOPFRONTS.flatMap(([from, to, color]): BoxItem[] => {
    const mid = (from + to) / 2;
    const width = to - from;
    return [
      { p: [mid, 4.5, 15.4], s: [width - 0.2, 1.1, 1.3], c: color },
      { p: [from + 0.6, 2, 15.4], s: [1, 4, 1.3], c: color },
      { p: [to - 0.6, 2, 15.4], s: [1, 4, 1.3], c: color },
      { p: [mid, 2, 14.6], s: [width - 2.2, 4, 0.3], c: '#343941' },
    ];
  }),
  // Fare gates in the yellow opening, ticket office in the maroon one.
  ...Array.from({ length: 6 }, (_, i): BoxItem => ({ p: [-21.5 + i * 1.8, 0.55, 15], s: [0.35, 1.1, 1.5], c: '#b9bdc2' })),
  { p: [-3, 1.3, 15.1], s: [9, 2.6, 1.2], c: '#f1f1ee' },
];

/** Orange steelwork under the canopy: a cantilever truss at each column and a lattice beam along the colonnade. */
const CANOPY_STEEL: Segment[] = (() => {
  const segments: Segment[] = [];
  for (const x of CANOPY_COLUMN_XS) {
    const head: THREE.Vector3Tuple = [x, 4.5, COLONNADE_Z];
    const panels = 5;
    segments.push(
      [[x, CANOPY_Y, CANOPY_BACK], [x, CANOPY_Y, CANOPY_FRONT], 0.14],
      [head, [x, CANOPY_Y - 0.2, CANOPY_FRONT], 0.14],
      [head, [x, CANOPY_Y, CANOPY_BACK], 0.1],
    );
    for (let k = 0; k < panels; k++) {
      const z0 = THREE.MathUtils.lerp(COLONNADE_Z, CANOPY_FRONT, k / panels);
      const z1 = THREE.MathUtils.lerp(COLONNADE_Z, CANOPY_FRONT, (k + 1) / panels);
      const low0 = THREE.MathUtils.lerp(4.5, CANOPY_Y - 0.2, k / panels);
      segments.push([[x, low0, z0], [x, CANOPY_Y, z1], 0.07]);
    }
  }
  const low = CANOPY_Y - 1.3;
  segments.push(
    [[CANOPY_START, CANOPY_Y, COLONNADE_Z], [CANOPY_END, CANOPY_Y, COLONNADE_Z], 0.13],
    [[CANOPY_START, low, COLONNADE_Z], [CANOPY_END, low, COLONNADE_Z], 0.13],
    [[CANOPY_START, CANOPY_Y, CANOPY_FRONT], [CANOPY_END, CANOPY_Y, CANOPY_FRONT], 0.13],
  );
  for (let x = CANOPY_START, k = 0; x < CANOPY_END; x += 2, k++) {
    segments.push(k % 2 === 0 ? [[x, low, COLONNADE_Z], [x + 2, CANOPY_Y, COLONNADE_Z], 0.06] : [[x, CANOPY_Y, COLONNADE_Z], [x + 2, low, COLONNADE_Z], 0.06]);
  }
  return segments;
})();

const CANOPY_COLUMNS: Segment[] = CANOPY_COLUMN_XS.map((x): Segment => [
  [x, 0, COLONNADE_Z],
  [x, CANOPY_Y, COLONNADE_Z],
]);
const CANOPY_POSTS: Segment[] = CANOPY_COLUMN_XS.map((x): Segment => [
  [x, 0, CANOPY_FRONT],
  [x, CANOPY_Y, CANOPY_FRONT],
]);

/** The ground-level entrance: canopy, colonnade, shopfronts, and the two signboards on the roof edge. */
function Entrance() {
  return (
    <group>
      <Boxes items={ENTRANCE_BOXES} />
      <Struts segments={CANOPY_STEEL} color={ORANGE} roughness={0.55} castShadow={false} />
      <Struts segments={CANOPY_COLUMNS} radius={0.42} color="#5b2d86" radialSegments={10} />
      <Struts segments={CANOPY_POSTS} radius={0.11} color="#3a3e44" castShadow={false} />
      <Sign
        position={[-29, CANOPY_Y + 2.2, CANOPY_FRONT - 0.6]}
        width={24}
        height={3.2}
        text="MALAYSIA BOLEH"
        background={['#eea21c', '#f6c644']}
        textScale={0.62}
      />
      <Sign
        position={[-4.5, CANOPY_Y + 2.3, CANOPY_FRONT - 0.6]}
        width={19}
        height={3.4}
        text="Bukit Jalil"
        subtitle="LRT Laluan Sri Petaling"
        background="#8a1c3a"
        textScale={0.46}
      />
      <Sign position={[-3, 4.5, 16.1]} width={10} height={0.9} depth={0.1} text="Bukit Jalil" background="#8a1c3a" textScale={0.7} />
    </group>
  );
}

/** South-east half of the frontage: the exposed structure, a blue-roofed link and a blue hoarding. */
const SIDE_LINK: BoxItem[] = [
  { p: [44, 3.2, 17.8], s: [34, 0.22, 3.6], c: '#2f6fd0' },
  { p: [44, 1.1, 15.4], s: [34, 2.2, 0.15], c: '#2b62bd' },
];
const SIDE_LINK_POSTS: Segment[] = Array.from({ length: 7 }, (_, i) => 28 + i * 5.3).flatMap((x) =>
  [16.2, 19.4].map((z): Segment => [
    [x, 0, z],
    [x, 3.1, z],
  ]),
);

/* -------------------------------------------------------------- taxi stand */

/** The road runs across the station's north-west end, parallel to local Z. */
export const ROAD_X = -75;
const KERB_X = -67.5;
const SHELTER_X = -64.8;

const RAINBOW = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa'];

const STREET_FURNITURE: BoxItem[] = [
  // Yellow-and-black kerb along the lay-by.
  ...Array.from({ length: 48 }, (_, i): BoxItem => ({ p: [KERB_X, 0.12, -40 + i * 2], s: [0.4, 0.24, 2], c: i % 2 === 0 ? '#e6b422' : '#232427' })),
  // The rainbow-painted balustrade beside the ramp.
  ...Array.from({ length: 40 }, (_, i): BoxItem => ({ p: [-61.5, 0.75, 6 + i], s: [0.14, 1, 0.92], c: RAINBOW[i % RAINBOW.length] })),
];

const STREET_POLES: Segment[] = [
  ...Array.from({ length: 13 }, (_, i) => -4 + i * 4.5).flatMap((z): Segment[] => [
    [
      [SHELTER_X - 1.6, 0, z],
      [SHELTER_X - 0.9, 2.75, z],
    ],
    [
      [SHELTER_X + 1.6, 0, z],
      [SHELTER_X + 0.9, 2.75, z],
    ],
  ]),
  // Street lamps on the far kerb, arms reaching over the carriageway.
  ...[-70, -25, 20, 60].flatMap((z): Segment[] => [
    [[ROAD_X - 8.5, 0, z], [ROAD_X - 8.5, 9, z], 0.13],
    [[ROAD_X - 8.5, 9, z], [ROAD_X - 5, 9.7, z], 0.09],
  ]),
];

/** Queueing taxis: z positions along the lay-by. */
const TAXI_RANK = [4, 10.5, 17, 23.5, 30];

function TaxiStand() {
  return (
    <group>
      {/* Corrugated barrel-vault shelter over the queue. */}
      <mesh position={[SHELTER_X, 2, 23]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.1, 2.1, 54, 14, 1, true, Math.PI - 1.22, 2.44]} />
        <meshStandardMaterial color="#e4e4df" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <Boxes items={STREET_FURNITURE} />
      <Struts segments={STREET_POLES} radius={0.07} color="#8a8f95" castShadow={false} />
      {TAXI_RANK.map((z) => (
        <Car key={z} taxi color="#c9242b" roof="#f3f3f1" position={[-69.5, 0, z]} rotation={[0, -Math.PI / 2, 0]} />
      ))}
      <Sign
        position={[-62.6, 3.3, 28]}
        rotation={[0, -Math.PI / 2, 0]}
        width={13}
        height={1.3}
        depth={0.12}
        text="SELAMAT DATANG"
        background="#2f9a4f"
        textScale={0.62}
      />
    </group>
  );
}

/* ------------------------------------------------------------------- plaza */

/** Stone benches with timber seats, scattered across the plaza. The south-east corner is kept clear for the shuttle queue. */
const BENCH_SPOTS: readonly (readonly [number, number, number])[] = [
  [-22, 47, 0.2],
  [-4, 53, -0.1],
  [14, 57, 0.4],
  [-38, 42, 0.1],
];
const BENCHES: BoxItem[] = BENCH_SPOTS.flatMap(([x, z, ry]): BoxItem[] => [
  { p: [x, 0.24, z], s: [2.8, 0.48, 1], ry, c: '#a9a8a3' },
  { p: [x, 0.52, z], s: [2.8, 0.08, 1], ry, c: '#9a6b3f' },
]);

const PLAZA_PALMS: readonly XZ[] = [
  [7, 37.5],
  [10.5, 34],
  [14, 37],
  [18, 33.5],
  [21.5, 37.5],
  [25, 34.5],
  [-58, 54],
  [-52, 60],
];

/** The telecom monopole that stands at the plaza's north-west corner. */
const TOWER: Segment[] = [
  [[-56, 0, 41], [-56, 34, 41], 0.42],
  ...[26, 29, 32].flatMap((y) =>
    [0, 1, 2].map((k): Segment => {
      const angle = (k / 3) * Math.PI * 2;
      return [[-56 + Math.cos(angle) * 0.9, y - 1.1, 41 + Math.sin(angle) * 0.9], [-56 + Math.cos(angle) * 0.9, y + 1.1, 41 + Math.sin(angle) * 0.9], 0.2];
    }),
  ),
];

/** Paved plaza: the frontage, the ground under the platforms, and the forecourt where the shuttle queue forms. */
const PLAZA_OUTLINE: readonly XZ[] = [
  [-66.5, -14],
  [62, -14],
  [74, 24],
  [76, 70],
  [70, 96],
  [56, 108],
  [36, 110],
  [18, 100],
  [4, 82],
  [-12, 68],
  [-44, 60],
  [-66.5, 50],
];

/** The stretch of Jalan Merah Caga that passes the station's north-west end, under the viaduct. */
const LAY_BY = { x: ROAD_X - 0.35, z: 5, width: 15.3, length: 106 };

/** Ground surfaces. They sit a few centimetres proud of the scene's ground plane. */
function Paving() {
  const plaza = useMemo(() => flatShapeGeometry(PLAZA_OUTLINE), []);
  return (
    <group>
      <mesh geometry={plaza} position={[0, 0.05, 0]} receiveShadow>
        <meshStandardMaterial color="#a4a6a1" roughness={0.95} />
      </mesh>
      <mesh position={[LAY_BY.x, 0.04, LAY_BY.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[LAY_BY.width, LAY_BY.length]} />
        <meshStandardMaterial color="#55585c" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** LRT Bukit Jalil: the elevated station, its entrance frontage, taxi stand and plaza. */
export function LrtStation() {
  return (
    <group position={[STATION.x, 0, STATION.z]} rotation={[0, stationRotationY, 0]}>
      <Paving />
      <StationRoof />
      <Boxes items={PLATFORMS} />
      <Boxes items={SUBSTRUCTURE} />
      <Flight position={[39, 0, 13.4]} />
      <Flight position={[-22, 0, -13.4]} rotationY={Math.PI} />
      <Flight position={[-51, 0, 15]} rotationY={Math.PI / 2} />
      <Entrance />
      <Boxes items={SIDE_LINK} />
      <Struts segments={SIDE_LINK_POSTS} radius={0.08} color="#eceeef" castShadow={false} />
      <TaxiStand />
      <Boxes items={BENCHES} />
      <Struts segments={TOWER} color="#b9bdc1" radialSegments={8} />
      <Palms positions={PLAZA_PALMS} />
    </group>
  );
}
