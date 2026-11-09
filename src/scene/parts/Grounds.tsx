import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, type InstancedMesh, Object3D } from 'three';
import { seededRandom } from '../../lib/random.ts';
import { M } from '../layout.ts';
import { zoneClick, type ZoneClick } from './shared.ts';

/** Everything here is modelled in metres (x east, z south) inside one group scaled by `M`. */
interface Placed { x: number; z: number; s: number; y?: number }

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
const palmCrownAt = (o: Object3D, p: Placed) => { o.position.set(p.x, 7.6 * p.s, p.z); o.scale.set(p.s, p.s * 0.32, p.s); };
const carBodyAt = (o: Object3D, p: Placed) => { o.position.set(p.x, 0.75, p.z); };
const carCabinAt = (o: Object3D, p: Placed) => { o.position.set(p.x, 1.55, p.z - 0.2); };

const noRaycast = () => null;

function Trees({ trees, palms }: { trees: Placed[]; palms: Placed[] }) {
  const trunks = useInstances(trees, trunkAt);
  const crowns = useInstances(trees, crownAt);
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
        <meshStandardMaterial color="#3f7d3a" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={palmTrunks} args={[undefined, undefined, palms.length]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[0.22, 0.34, 7.5, 6]} />
        <meshStandardMaterial color="#8a7458" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={palmCrowns} args={[undefined, undefined, palms.length]} castShadow raycast={noRaycast}>
        <icosahedronGeometry args={[3.4, 0]} />
        <meshStandardMaterial color="#4f9a45" roughness={1} flatShading />
      </instancedMesh>
    </>
  );
}

const CAR_COLORS = ['#f4f4f2', '#d7d9db', '#1f2226', '#8b8f94', '#b3261e', '#274b8f', '#e0b03a', '#f4f4f2', '#5a5d61'];

function Cars({ cars, colors }: { cars: Placed[]; colors: string[] }) {
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

/** The paved site, forecourt parking (car park Zone B), lawn, courts and planting around the buildings. */
export function Grounds({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const { trees, palms, cars, carColors } = useMemo(() => {
    const r = seededRandom(7);
    const trees: Placed[] = [];
    const palms: Placed[] = [];
    const tree = (x: number, z: number, y = 0) =>
      trees.push({ x: x + (r() - 0.5) * 2, z: z + (r() - 0.5) * 2, s: 0.8 + r() * 0.5, y });

    // Along the frontage, stopping short of the sign, the stop and the queue in front of the atrium.
    for (let x = -105; x <= 50; x += 8.5) tree(x, 55);
    for (let z = -100; z <= 40; z += 9) tree(-112, z);
    for (let x = -100; x <= 120; x += 9) tree(x, -114);
    // The courtyard garden between the two front blocks
    for (let i = 0; i < 9; i++) tree(-4 + Math.cos(i * 0.7) * 6, 20 + i * 1.6);
    // Roof gardens on the podium
    for (const [x, z] of [[-50, -11], [-44, -15], [42, -12]] as const) trees.push({ x, z, s: 0.55, y: 12 });

    for (let x = -96; x <= 44; x += 10) palms.push({ x, z: 39, s: 0.9 + r() * 0.3 });
    for (const [x, z] of [[58, 44], [124, 22]] as const) palms.push({ x, z, s: 1 + r() * 0.3 });

    const cars: Placed[] = [];
    for (let x = -94; x <= 46; x += 3.1) if (r() > 0.3) cars.push({ x, z: 46.5, s: 1 });
    const carColors = cars.map(() => CAR_COLORS[Math.floor(r() * CAR_COLORS.length)]!);
    return { trees, palms, cars, carColors };
  }, []);

  return (
    <group scale={M}>
      <Slab x={8} z={-32} w={232} d={166} color="#a4a6a1" />
      <Slab x={-4} z={31} w={20} d={22} y={0.15} color="#6f9f58" />

      {/* Forecourt parking: car park Zone B */}
      <group onClick={zoneClick(onZoneClick, 'carpark-b')}>
        <Slab x={-24} z={45} w={150} d={12} y={0.15} color="#55585c" />
        <Cars cars={cars} colors={carColors} />
      </group>

      <Court x={-42} z={92} />
      {/* Rooftop futsal court on the podium */}
      <Court x={-4} z={-11} y={12.06} w={24} d={12} />

      <Trees trees={trees} palms={palms} />
    </group>
  );
}
