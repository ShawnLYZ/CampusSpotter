import { useCallback, useMemo } from 'react';
import * as THREE from 'three';
import type { XZ } from '../siteLayout.ts';
import { Instanced, type InstanceBuilder } from '../helpers/Instanced.tsx';
import { seededRandom } from '../../../lib/random.ts';

const FRONDS = 13;
/** Each frond is two blades end to end: one rising from the crown, one drooping from its tip. */
const BLADES = 2;
const BLADE_LENGTH = 2.5;
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const blade = new THREE.Quaternion();
const reach = new THREE.Vector3();

/** Royal palms at the given ground positions (in the parent's frame). */
export function Palms({ positions, seed = 3 }: { positions: readonly XZ[]; seed?: number }) {
  const palms = useMemo(() => {
    const rand = seededRandom(seed);
    return positions.map(([x, z]) => ({ x, z, height: 9 + rand() * 3.5, turn: rand() * Math.PI * 2 }));
  }, [positions, seed]);

  const buildTrunk = useCallback<InstanceBuilder>(
    (i, object) => {
      const palm = palms[i];
      object.position.set(palm.x, palm.height / 2, palm.z);
      object.scale.set(1, palm.height, 1);
    },
    [palms],
  );

  const buildFrond = useCallback<InstanceBuilder>(
    (i, object) => {
      const palm = palms[Math.floor(i / (FRONDS * BLADES))];
      const frond = Math.floor(i / BLADES) % FRONDS;
      const outer = i % BLADES === 1;
      const yaw = palm.turn + (frond / FRONDS) * Math.PI * 2;
      // Alternate fronds spring up more steeply, so the crown reads as a tuft rather than a disc.
      const rise = frond % 2 === 0 ? 0.25 : 0.75;
      const droop = rise - 1.05;

      // Walk out from the crown: the inner blade rises, the outer one hangs from its tip.
      object.position.set(palm.x, palm.height + 0.1, palm.z);
      blade.setFromAxisAngle(AXIS_Y, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, rise));
      if (outer) {
        object.position.add(reach.set(BLADE_LENGTH, 0, 0).applyQuaternion(blade));
        blade.setFromAxisAngle(AXIS_Y, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, droop));
      }
      object.position.add(reach.set(BLADE_LENGTH / 2, 0, 0).applyQuaternion(blade));
      object.quaternion.copy(blade);
      if (outer) object.scale.set(1, 1, 0.7);
    },
    [palms],
  );

  return (
    <group>
      <Instanced count={palms.length} build={buildTrunk} receiveShadow={false}>
        <cylinderGeometry args={[0.2, 0.3, 1, 8]} />
        <meshStandardMaterial color="#a39a86" roughness={1} />
      </Instanced>
      <Instanced count={palms.length * FRONDS * BLADES} build={buildFrond}>
        <boxGeometry args={[BLADE_LENGTH, 0.06, 0.7]} />
        <meshStandardMaterial color="#4e8c39" roughness={0.9} />
      </Instanced>
    </group>
  );
}
