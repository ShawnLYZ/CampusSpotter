import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';
import { GREY, WHITE, zoneClick, type ZoneClick } from './shared.ts';

const X0 = -24, X1 = 22, Z = -1, DECK_Y = 2.1, ROOF_Y = 6.5;

/** The covered walkway between the two rows: raised deck and a floating roof slab on slim columns. */
export function Spine({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const cols = useRef<InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = X0 + 2; x <= X1 - 2; x += 6) out.push([x, Z - 2.3], [x, Z + 2.3]);
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = cols.current;
    if (!m) return;
    const o = new Object3D();
    spots.forEach(([x, z], i) => { o.position.set(x, ROOF_Y / 2, z); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return (
    <group onClick={zoneClick(onZoneClick, 'spine')}>
      <mesh position={[(X0 + X1) / 2, DECK_Y - 0.1, Z]} castShadow receiveShadow>
        <boxGeometry args={[X1 - X0, 0.2, 3]} />
        <meshStandardMaterial color={GREY} roughness={1} />
      </mesh>
      <mesh position={[(X0 + X1) / 2, ROOF_Y, Z]} castShadow receiveShadow>
        <boxGeometry args={[50, 0.2, 6]} />
        <meshStandardMaterial color={WHITE} roughness={0.9} />
      </mesh>
      <instancedMesh ref={cols} args={[undefined, undefined, spots.length]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, ROOF_Y, 6]} />
        <meshStandardMaterial color={GREY} />
      </instancedMesh>
    </group>
  );
}
