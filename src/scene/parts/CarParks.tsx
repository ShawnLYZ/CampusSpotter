import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import { seededRandom } from '../../lib/random.ts';
import { itemById } from '../layout.ts';
import { GREY, LINE, WHITE, floorLinePositions, zoneClick, type ZoneClick } from './shared.ts';

const CAR_COLOURS = ['#f2f2ee', '#f2f2ee', '#d9dbd6', '#9a9d98', '#c94a43', '#e6b93a'];

/** Car park A (covered, three decks) and car park B (open pad with instanced cars). */
export function CarParks({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  return (
    <>
      <CoveredCarPark onZoneClick={onZoneClick} />
      <OpenCarPark onZoneClick={onZoneClick} />
    </>
  );
}

function CoveredCarPark({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const it = itemById('carpark-a')!;
  const w = it.w ?? 10, d = it.d ?? 10, floors = it.floors ?? 3;
  const h = floors * 0.7;
  const lines = useMemo(() => floorLinePositions(w, d, h + 0.01, 0.7, 0.03), [w, d, h]);
  const decks = Array.from({ length: floors }, (_, i) => i);
  const posts: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]];
  return (
    <group position={[it.x, 0, it.z]} onClick={zoneClick(onZoneClick, 'carpark-a')}>
      {decks.map((i) => (
        <mesh key={i} position={[0, 0.7 * (i + 1) - 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.2, d]} />
          <meshStandardMaterial color={WHITE} roughness={0.95} />
        </mesh>
      ))}
      {posts.map(([sx, sz], i) => (
        <mesh key={i} position={[(sx * (w - 0.4)) / 2, h / 2, (sz * (d - 0.4)) / 2]} castShadow>
          <boxGeometry args={[0.35, h, 0.35]} />
          <meshStandardMaterial color={GREY} />
        </mesh>
      ))}
      <lineSegments>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[lines, 3]} /></bufferGeometry>
        <lineBasicMaterial color={LINE} />
      </lineSegments>
    </group>
  );
}

function OpenCarPark({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const it = itemById('carpark-b')!;
  const w = it.w ?? 40, d = it.d ?? 6;
  const cars = useRef<InstancedMesh>(null);
  const bays = useRef<InstancedMesh>(null);
  const spots = useMemo(() => {
    const rnd = seededRandom(11);
    const out: { x: number; z: number; c: Color }[] = [];
    for (const z of [-d / 4, d / 4]) {
      for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 1.6) {
        if (rnd() < 0.3) continue;
        out.push({ x, z, c: new Color(CAR_COLOURS[Math.floor(rnd() * CAR_COLOURS.length)]) });
      }
    }
    return out;
  }, [w, d]);
  const bayXs = useMemo(() => {
    const xs: number[] = [];
    for (let x = -w / 2 + 0.2; x <= w / 2; x += 1.6) xs.push(x);
    return xs;
  }, [w]);

  useLayoutEffect(() => {
    const o = new Object3D();
    const m = cars.current;
    if (m) {
      spots.forEach((s, i) => { o.position.set(s.x, 0.22, s.z); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, s.c); });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    const b = bays.current;
    if (b) {
      bayXs.forEach((x, i) => { o.position.set(x, 0.035, 0); o.updateMatrix(); b.setMatrixAt(i, o.matrix); });
      b.instanceMatrix.needsUpdate = true;
    }
  }, [spots, bayXs]);

  return (
    <group position={[it.x, 0, it.z]} onClick={zoneClick(onZoneClick, 'carpark-b')}>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[w, 0.06, d]} />
        <meshStandardMaterial color="#c3c6c1" roughness={1} />
      </mesh>
      <instancedMesh ref={bays} args={[undefined, undefined, bayXs.length]}>
        <boxGeometry args={[0.05, 0.02, d - 0.4]} />
        <meshStandardMaterial color="#eceee9" />
      </instancedMesh>
      <instancedMesh ref={cars} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.36, 1.0]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </group>
  );
}
