import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { GRID, GROUND } from './shared.ts';

const W = 400, D = 200, CELL = 5;

/** Square-cell grid lines (CELL units) covering the W x D ground, at y = 0. */
function gridPositions(): Float32Array {
  const out: number[] = [];
  for (let x = -W / 2; x <= W / 2; x += CELL) out.push(x, 0, -D / 2, x, 0, D / 2);
  for (let z = -D / 2; z <= D / 2; z += CELL) out.push(-W / 2, 0, z, W / 2, 0, z);
  return new Float32Array(out);
}

/** The single dark ground plane (400 x 200) with a faint square grid, centred over the whole model. */
export function Ground({ onClick }: { onClick?: () => void }) {
  const lines = useMemo(gridPositions, []);
  // Ignore the click that ends an orbit drag (R3F reports the pointer travel in `delta`).
  const click = (e: ThreeEvent<MouseEvent>) => { if (e.delta <= 2) onClick?.(); };
  return (
    <group position={[-45, 0, 15]} onClick={onClick ? click : undefined}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={GROUND} roughness={1} />
      </mesh>
      <lineSegments position={[0, -0.01, 0]}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[lines, 3]} /></bufferGeometry>
        <lineBasicMaterial color={GRID} transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
}
