import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';
import { seededRandom } from '../../lib/random.ts';

const TREE_GREEN = '#4f8a5b';
/** Courtyard trees between the blocks and in the strip in front of the front row. */
const COURTYARD: [number, number][] = [
  [-22, 13], [-16, 13.5], [-10, 13], [-4, 13.5], [2, 13], [-26, 1.2],
  [-14, -8], [-1, -9], [12, -8], [-27, -8], [22, 2], [-12, -14],
];

interface Tree { x: number; z: number; s: number; cone: boolean }

/** Verge trees along z = 22 plus courtyard trees as two InstancedMeshes (cone canopy + sphere canopy). */
export function Trees() {
  const cones = useRef<InstancedMesh>(null);
  const spheres = useRef<InstancedMesh>(null);
  const trees = useMemo(() => {
    const rnd = seededRandom(7);
    const list: Tree[] = [];
    for (let x = -40; x <= 40; x += 3) {
      list.push({ x: x + (rnd() - 0.5) * 0.8, z: 22 + (rnd() - 0.5) * 0.6, s: 0.8 + rnd() * 0.5, cone: rnd() < 0.5 });
    }
    for (const [x, z] of COURTYARD) {
      list.push({ x: x + (rnd() - 0.5) * 1.2, z: z + (rnd() - 0.5) * 1.2, s: 0.9 + rnd() * 0.6, cone: rnd() < 0.5 });
    }
    return list;
  }, []);
  const coneTrees = useMemo(() => trees.filter((t) => t.cone), [trees]);
  const sphereTrees = useMemo(() => trees.filter((t) => !t.cone), [trees]);

  useLayoutEffect(() => {
    const o = new Object3D();
    const fill = (m: InstancedMesh | null, list: Tree[], y: number) => {
      if (!m) return;
      list.forEach((t, i) => {
        o.position.set(t.x, y * t.s, t.z);
        o.scale.setScalar(t.s);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    };
    fill(cones.current, coneTrees, 0.9);
    fill(spheres.current, sphereTrees, 0.95);
  }, [coneTrees, sphereTrees]);

  return (
    <>
      <instancedMesh ref={cones} args={[undefined, undefined, coneTrees.length]} castShadow>
        <coneGeometry args={[0.65, 1.8, 6]} />
        <meshStandardMaterial color={TREE_GREEN} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={spheres} args={[undefined, undefined, sphereTrees.length]} castShadow>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={TREE_GREEN} roughness={1} flatShading />
      </instancedMesh>
    </>
  );
}
