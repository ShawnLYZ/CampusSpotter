import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { FLOOR_HEIGHT, M, itemById } from '../layout.ts';
import { Block } from './Block.tsx';
import { Court } from './Grounds.tsx';
import { ROOF_METAL, WALL, loftGeometry, roundedRing } from './materials.ts';

const TERRACES = ['sports-1', 'sports-2', 'sports-3'];
/** The drop-off canopy on the north-east corner: centre in scene units, height in metres. */
const DROP_OFF = { x: 21.6, z: -29.9, y: 7 };
const swallow = (e: ThreeEvent<MouseEvent>) => e.stopPropagation();

/**
 * The sports and recreation block: three terraces stepping down to the north-east corner, the futsal court on the
 * top one and gardens on the lower two, a tall fin wall on the street side and the rear drop-off canopy.
 * It is not a forecast zone, so clicks on it do nothing.
 */
export function Sports() {
  const top = itemById('sports-1')!;
  const roofY = ((top.floors ?? 0) * FLOOR_HEIGHT) / M + 0.8;
  const canopy = useMemo(() => {
    const ring = roundedRing(12, 5.5, 3);
    return loftGeometry([{ pts: ring, y: 0 }, { pts: ring, y: 0.7 }], { smooth: true });
  }, []);
  return (
    <group onClick={swallow}>
      {TERRACES.map((id) => <Block key={id} item={itemById(id)!} zoneId={null} />)}
      <group position={[top.x, 0, top.z]} scale={M}>
        <Court x={-8} z={0} y={roofY} w={26} d={12} />
        {/* Fin wall on the east street */}
        <mesh position={[(top.w ?? 0) / M / 2 + 3.2, 16, -2]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 32, 15]} />
          <meshStandardMaterial color={WALL} roughness={0.85} />
        </mesh>
      </group>
      <group position={[DROP_OFF.x, 0, DROP_OFF.z]} scale={M}>
        <mesh geometry={canopy} position={[0, DROP_OFF.y, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={ROOF_METAL} roughness={0.5} metalness={0.3} />
        </mesh>
        {[-7, 0, 7].map((x) => (
          <mesh key={x} position={[x, DROP_OFF.y / 2, 2.5]} castShadow>
            <cylinderGeometry args={[0.4, 0.4, DROP_OFF.y, 10]} />
            <meshStandardMaterial color={WALL} roughness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
