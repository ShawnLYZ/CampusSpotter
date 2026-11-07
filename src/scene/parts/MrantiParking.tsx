import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import { seededRandom } from '../../lib/random.ts';
import { zoneClick, type ZoneClick } from './shared.ts';

const CAR_COLOURS = ['#f2f2ee', '#f2f2ee', '#d9dbd6', '#9a9d98', '#c94a43', '#e6b93a'];
const W = 25, D = 15;

/** MRANTI Park concert parking: flat pad with instanced cars. Rendered only when `visible`. */
export function MrantiParking({ visible, onZoneClick }: { visible: boolean; onZoneClick?: ZoneClick }) {
  const cars = useRef<InstancedMesh>(null);
  const spots = useMemo(() => {
    const rnd = seededRandom(29);
    const out: { x: number; z: number; c: Color }[] = [];
    for (let z = -D / 2 + 1.5; z <= D / 2 - 1.5; z += 2.2) {
      for (let x = -W / 2 + 1; x <= W / 2 - 1; x += 1.6) {
        if (rnd() < 0.15) continue;
        out.push({ x: x + (rnd() - 0.5) * 0.1, z, c: new Color(CAR_COLOURS[Math.floor(rnd() * CAR_COLOURS.length)]) });
      }
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = cars.current;
    if (!m) return;
    const o = new Object3D();
    spots.forEach((s, i) => { o.position.set(s.x, 0.22, s.z); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, s.c); });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [spots, visible]);
  if (!visible) return null;
  return (
    <group position={[45, 0.02, 30]} onClick={zoneClick(onZoneClick, 'mranti-parking')}>
      <mesh receiveShadow>
        <boxGeometry args={[W, 0.06, D]} />
        <meshStandardMaterial color="#c3c6c1" roughness={1} />
      </mesh>
      <instancedMesh ref={cars} args={[undefined, undefined, spots.length]} castShadow>
        <boxGeometry args={[1.1, 0.4, 0.7]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </group>
  );
}
