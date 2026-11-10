import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { STADIUM } from '../siteLayout.ts';
import { ellipseCurve } from '../helpers/geometry.ts';
import { EVENT_GLOW } from './StadiumShell.tsx';

const PANELS = 36;
const RADIAL_STEPS = 8;
/** Two angular steps per panel: a ridge on each joint and a valley between. */
const ANGULAR_STEPS = PANELS * 2;

/**
 * A point on the membrane. `i` counts angular steps (even = ridge, odd =
 * valley) and `t` runs from 0 at the outer compression ring to 1 at the
 * inner tension ring. The roof arches gently between the two rings, and the
 * folds are deepest mid-span.
 */
function membranePoint(i: number, t: number, lift = 0): THREE.Vector3Tuple {
  const { rx, rz, roofInnerRx, roofInnerRz, rimY, roofInnerY } = STADIUM;
  const angle = (i / ANGULAR_STEPS) * Math.PI * 2;
  const fold = (i % 2 === 0 ? 1 : -1) * (0.45 + 2.5 * Math.sin(Math.PI * t));
  const y = THREE.MathUtils.lerp(rimY, roofInnerY, t) + 3.2 * Math.sin(Math.PI * t) + fold + lift;
  return [Math.cos(angle) * THREE.MathUtils.lerp(rx + 3, roofInnerRx, t), y, Math.sin(angle) * THREE.MathUtils.lerp(rz + 3, roofInnerRz, t)];
}

function buildMembrane(): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i < ANGULAR_STEPS; i++) {
    for (let j = 0; j < RADIAL_STEPS; j++) {
      const a = membranePoint(i, j / RADIAL_STEPS);
      const b = membranePoint(i + 1, j / RADIAL_STEPS);
      const c = membranePoint(i + 1, (j + 1) / RADIAL_STEPS);
      const d = membranePoint(i, (j + 1) / RADIAL_STEPS);
      // Unshared vertices keep each fold crisp; winding puts the lit side on top.
      positions.push(...a, ...d, ...b, ...b, ...d, ...c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The ridge cables, drawn just proud of the fabric. Consecutive pairs of points are one line. */
const RIDGE_CABLES: THREE.Vector3Tuple[] = Array.from({ length: PANELS }, (_, panel) => panel * 2).flatMap((i) =>
  Array.from({ length: RADIAL_STEPS }, (_, j) => [membranePoint(i, j / RADIAL_STEPS, 0.12), membranePoint(i, (j + 1) / RADIAL_STEPS, 0.12)]).flat(),
);

/**
 * The membrane roof: a ring of radial panels folded into ridges and valleys
 * between an outer compression ring and an inner tension ring.
 */
export function StadiumRoof({ glowing }: { glowing: boolean }) {
  const membrane = useMemo(buildMembrane, []);
  const tensionRing = useMemo(
    () => new THREE.TubeGeometry(ellipseCurve(STADIUM.roofInnerRx, STADIUM.roofInnerRz, STADIUM.roofInnerY, 96), 192, 0.9, 8, true),
    [],
  );
  return (
    <group>
      <mesh geometry={membrane} castShadow receiveShadow>
        <meshStandardMaterial color="#f5f4ee" roughness={0.9} side={THREE.DoubleSide} emissive={EVENT_GLOW} emissiveIntensity={glowing ? 0.3 : 0} />
      </mesh>
      <Line points={RIDGE_CABLES} segments color="#a9adb1" lineWidth={1} />
      <mesh geometry={tensionRing} castShadow>
        <meshStandardMaterial color="#7f8488" roughness={0.6} metalness={0.2} />
      </mesh>
    </group>
  );
}
