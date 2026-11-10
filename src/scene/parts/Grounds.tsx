import { useLayoutEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, type InstancedMesh, Object3D } from 'three';
import { seededRandom } from '../../lib/random.ts';
import { M, SITE } from '../layout.ts';
import { wedgeGeometry } from './materials.ts';
import { zoneClick, type ZoneClick } from './shared.ts';

/** Everything here is modelled in metres (x east, z south) inside one group scaled by `M`. */
interface Placed { x: number; z: number; s: number; y?: number }

const PAVING = '#a4a6a1';
const LAWN = '#5f8f52';
const ASPHALT = '#55585c';

function useInstances(items: Placed[], at: (o: Object3D, p: Placed) => void, colors?: string[]) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    const c = new Color();
    items.forEach((p, i) => {
      o.position.set(0, 0, 0);
      o.scale.setScalar(1);
      at(o, p);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      if (colors) mesh.setColorAt(i, c.set(colors[i]!));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items, at, colors]);
  return ref;
}

const trunkAt = (o: Object3D, p: Placed) => { o.position.set(p.x, (p.y ?? 0) + 2 * p.s, p.z); o.scale.setScalar(p.s); };
const crownAt = (o: Object3D, p: Placed) => { o.position.set(p.x, (p.y ?? 0) + 6 * p.s, p.z); o.scale.set(p.s, p.s * 1.1, p.s); };
const palmTrunkAt = (o: Object3D, p: Placed) => { o.position.set(p.x, 3.75 * p.s, p.z); o.scale.setScalar(p.s); };
const palmCrownAt = (o: Object3D, p: Placed) => { o.position.set(p.x, 7.3 * p.s, p.z); o.scale.setScalar(p.s); o.rotation.set(0, p.x + p.z, 0); };
const carBodyAt = (o: Object3D, p: Placed) => { o.position.set(p.x, 0.75, p.z); };
const carCabinAt = (o: Object3D, p: Placed) => { o.position.set(p.x, 1.55, p.z - 0.2); };

const noRaycast = () => null;

/** A palm's head: fronds arching out and drooping at the tip. */
function frondGeometry(blades = 9): BufferGeometry {
  // radius, height, half-width at three stations along a frond
  const stations = [[0.2, 0.2, 0.35], [2.2, 1.1, 0.85], [4, -0.2, 0.1]] as const;
  const pos: number[] = [];
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
    const at = (r: number, y: number, side: number) => [r * cos - side * sin, y, r * sin + side * cos];
    for (let s = 0; s < stations.length - 1; s++) {
      const [r0, y0, w0] = stations[s]!, [r1, y1, w1] = stations[s + 1]!;
      const q = [at(r0, y0, -w0), at(r0, y0, w0), at(r1, y1, w1), at(r1, y1, -w1)];
      pos.push(...q[0]!, ...q[1]!, ...q[2]!, ...q[0]!, ...q[2]!, ...q[3]!);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

const LEAF = ['#3f7d3a', '#4a8a40', '#356f36', '#55934a'];

function Trees({ trees, palms }: { trees: Placed[]; palms: Placed[] }) {
  const leaf = useMemo(() => trees.map((_, i) => LEAF[i % LEAF.length]!), [trees]);
  const fronds = useMemo(() => frondGeometry(), []);
  const trunks = useInstances(trees, trunkAt);
  const crowns = useInstances(trees, crownAt, leaf);
  const palmTrunks = useInstances(palms, palmTrunkAt);
  const palmCrowns = useInstances(palms, palmCrownAt);
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[0.3, 0.45, 4, 6]} />
        <meshStandardMaterial color="#6b5138" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, trees.length]} castShadow raycast={noRaycast}>
        <icosahedronGeometry args={[3, 1]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={palmTrunks} args={[undefined, undefined, palms.length]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[0.22, 0.34, 7.5, 6]} />
        <meshStandardMaterial color="#8a7458" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={palmCrowns} args={[fronds, undefined, palms.length]} castShadow raycast={noRaycast}>
        <meshStandardMaterial color="#4f9a45" roughness={1} side={DoubleSide} />
      </instancedMesh>
    </>
  );
}

export const CAR_COLORS = ['#f4f4f2', '#d7d9db', '#1f2226', '#8b8f94', '#b3261e', '#274b8f', '#e0b03a', '#f4f4f2', '#5a5d61'];

/** Parked cars, in metres. */
export function Cars({ cars, colors }: { cars: Placed[]; colors: string[] }) {
  const bodies = useInstances(cars, carBodyAt, colors);
  const cabins = useInstances(cars, carCabinAt);
  return (
    <>
      <instancedMesh ref={bodies} args={[undefined, undefined, cars.length]} castShadow>
        <boxGeometry args={[1.9, 0.9, 4.4]} />
        <meshStandardMaterial roughness={0.4} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={cabins} args={[undefined, undefined, cars.length]}>
        <boxGeometry args={[1.6, 0.6, 2]} />
        <meshStandardMaterial color="#4a5a66" roughness={0.2} metalness={0.4} />
      </instancedMesh>
    </>
  );
}

function Slab({ x, z, w, d, y = 0.1, color }: { x: number; z: number; w: number; d: number; y?: number; color: string }) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

/** A round planter: a low white ring filled with planting. */
function Planter({ x, z, r = 3.2, y = 0 }: { x: number; z: number; r?: number; y?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, 0.8, 24]} />
        <meshStandardMaterial color="#e6e6e1" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.82, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r - 0.5, 24]} />
        <meshStandardMaterial color="#4f8a47" roughness={1} />
      </mesh>
    </group>
  );
}

/** A futsal or basketball court: a coloured surround, a playing surface and its lines. Metres. */
export function Court({ x, z, y = 0.3, w = 30, d = 17 }: { x: number; z: number; y?: number; w?: number; d?: number }) {
  return (
    <group position={[x, y, z]}>
      <Slab x={0} z={0} y={0} w={w + 5} d={d + 5} color="#d98a3d" />
      <Slab x={0} z={0} y={0.1} w={w} d={d} color="#4d8fd1" />
      <Slab x={0} z={0} y={0.2} w={0.3} d={d} color="#ffffff" />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Slab x={(s * w) / 2} z={0} y={0.2} w={0.3} d={d} color="#ffffff" />
          <Slab x={0} z={(s * d) / 2} y={0.2} w={w} d={0.3} color="#ffffff" />
        </group>
      ))}
      <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.6, 2.9, 40]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

/** The site in metres. */
const X0 = SITE.x0 / M, X1 = SITE.x1 / M, Z0 = SITE.z0 / M, Z1 = SITE.z1 / M;

/**
 * The paved site between its four streets: verges and street trees, the palm-lined forecourt parking (car park
 * Zone B), the garden courts between the blocks, the grassed ramp on the south-west corner, the rear car park
 * and the roof gardens.
 */
export function Grounds({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const { trees, palms, cars, carColors, rear, rearColors } = useMemo(() => {
    const r = seededRandom(7);
    const trees: Placed[] = [];
    const palms: Placed[] = [];
    const tree = (x: number, z: number, y = 0, s = 0.8 + r() * 0.5) =>
      trees.push({ x: x + (r() - 0.5) * 2, z: z + (r() - 0.5) * 2, s, y });

    // Street trees on all four sides. The south row stops short of the atrium forecourt, where the shuttle queue
    // stands; the west row leaves the residences' entrance clear; the north row ends at the rear car park.
    for (let x = X0 + 6; x <= 46; x += 8.5) tree(x, Z1 - 3);
    for (let z = Z0 + 8; z <= Z1 - 10; z += 9) if (z < -137 || z > -109) tree(X0 + 3.5, z);
    for (let x = X0 + 10; x <= 56; x += 9) tree(x, Z0 + 3.5);
    for (let z = Z0 + 18; z <= -40; z += 9) tree(X1 - 3.5, z);
    // Garden court between Blocks A and B
    for (const [x, z] of [[-21.5, 4], [-15.5, 10], [-21.5, 17], [-15.5, 24], [-19, 32]] as const) tree(x, z);
    // Garden court between the library and Block E
    for (const [x, z] of [[66, -70], [77, -67], [99, -73], [109, -68]] as const) tree(x, z);
    // Service yard west of the podium
    for (const z of [-37, -67, -86]) for (const x of [-96, -78]) tree(x, z, 0, 0.7);
    // Roof gardens: the podium's west edge and the light well between the two bars, then the residences' podium
    for (const [x, z] of [[-63, -38], [-63, -52], [-63, -66], [-63, -80], [-34, -60.5], [-6, -60.5], [20, -60.5]] as const) tree(x, z, 12, 0.55);
    for (const [x, z] of [[-64, -113], [-38, -119], [-14, -119], [16, -113], [-70, -132]] as const) tree(x, z, 8, 0.6);

    const palm = (x: number, z: number) => palms.push({ x, z, s: 0.9 + r() * 0.3 });
    for (let x = X0 + 10; x <= 46; x += 10) palm(x, 37);
    for (let z = -140; z <= -44; z += 12) palm(X1 - 10, z);

    const paint = (list: Placed[]) => list.map(() => CAR_COLORS[Math.floor(r() * CAR_COLORS.length)]!);
    const cars: Placed[] = [];
    for (const z of [42.3, 47.7]) for (let x = -95; x <= 47; x += 2.9) if (r() > 0.28) cars.push({ x, z, s: 1 });
    // Open bays that are not part of Zone B: the rear car park and the service yard on the west side.
    const rear: Placed[] = [];
    for (let x = 62; x <= 92; x += 2.9) if (r() > 0.3) rear.push({ x, z: Z0 + 5.5, s: 1 });
    for (let x = -98; x <= -76; x += 2.9) for (const z of [-22, -52]) if (r() > 0.35) rear.push({ x, z, s: 1 });
    return { trees, palms, cars, carColors: paint(cars), rear, rearColors: paint(rear) };
  }, []);
  const ramp = useMemo(() => wedgeGeometry(30, 32, 7), []);

  return (
    <group scale={M}>
      <Slab x={(X0 + X1) / 2} z={(Z0 + Z1) / 2} w={X1 - X0} d={Z1 - Z0} color={PAVING} />
      {/* Verges inside the kerb */}
      <Slab x={-30} z={Z1 - 3} w={158} d={5.5} y={0.15} color={LAWN} />
      <Slab x={X0 + 3.5} z={(Z0 + Z1) / 2} w={6} d={Z1 - Z0 - 2} y={0.15} color={LAWN} />
      <Slab x={-25.5} z={Z0 + 3.5} w={167} d={6} y={0.15} color={LAWN} />
      <Slab x={X1 - 3.5} z={-91} w={6} d={110} y={0.15} color={LAWN} />
      {/* Garden courts */}
      <Slab x={-18.5} z={17} w={15} d={34} y={0.15} color={LAWN} />
      <Planter x={-18.5} z={11} />
      <Planter x={-18.5} z={25} />
      <Slab x={87.5} z={-70} w={54} d={14} y={0.15} color={LAWN} />
      <Planter x={88} z={-70} r={4} />
      <Planter x={72} z={-72.5} r={2.6} />
      <Planter x={104} z={-67.5} r={2.6} />

      {/* Grassed ramp over the car park entrance on the south-west corner */}
      <mesh geometry={ramp} position={[-88, 0, 14]} castShadow receiveShadow>
        <meshStandardMaterial color={LAWN} roughness={1} />
      </mesh>

      {/* Forecourt parking: car park Zone B */}
      <group onClick={zoneClick(onZoneClick, 'carpark-b')}>
        <Slab x={-24} z={45} w={150} d={12} y={0.15} color={ASPHALT} />
        <Cars cars={cars} colors={carColors} />
      </group>
      {/* Rear car park beside the sports block's drop-off, and the service yard west of the podium */}
      <Slab x={79} z={Z0 + 5.5} w={38} d={9} y={0.15} color={ASPHALT} />
      <Slab x={-86.5} z={-45} w={29} d={78} y={0.15} color={ASPHALT} />
      <Cars cars={rear} colors={rearColors} />

      <Trees trees={trees} palms={palms} />
    </group>
  );
}
