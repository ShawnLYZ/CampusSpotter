import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';

/**
 * Sets up one instance. The object arrives reset (origin, no rotation, unit
 * scale) and the colour arrives white; mutate either.
 */
export type InstanceBuilder = (index: number, object: THREE.Object3D, color: THREE.Color) => void;

interface InstancedProps {
  count: number;
  build: InstanceBuilder;
  /** Write per-instance colours (multiplied with the material colour). */
  colored?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Geometry and material elements. */
  children: ReactNode;
}

/** A static InstancedMesh whose transforms come from a builder callback. */
export function Instanced({ count, build, colored = false, castShadow = true, receiveShadow = true, children }: InstancedProps) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      object.position.set(0, 0, 0);
      object.quaternion.identity();
      object.scale.set(1, 1, 1);
      color.set(0xffffff);
      build(i, object, color);
      object.updateMatrix();
      mesh.setMatrixAt(i, object.matrix);
      if (colored) mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [count, build, colored]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow={castShadow} receiveShadow={receiveShadow}>
      {children}
    </instancedMesh>
  );
}

export interface BoxItem {
  /** Centre. */
  p: readonly [number, number, number];
  /** Size. */
  s: readonly [number, number, number];
  /** Rotation about the vertical axis. */
  ry?: number;
  /** Per-box colour; overrides the shared colour. */
  c?: THREE.ColorRepresentation;
}

interface BoxesProps {
  items: readonly BoxItem[];
  color?: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/** Many axis-aligned (optionally yawed) boxes drawn as one instanced mesh. */
export function Boxes({ items, color = '#ffffff', roughness = 0.85, metalness = 0, castShadow = true, receiveShadow = true }: BoxesProps) {
  const colored = items.some((item) => item.c !== undefined);
  const build = useCallback<InstanceBuilder>(
    (i, object, instanceColor) => {
      const item = items[i];
      object.position.set(item.p[0], item.p[1], item.p[2]);
      object.scale.set(item.s[0], item.s[1], item.s[2]);
      object.rotation.set(0, item.ry ?? 0, 0);
      instanceColor.set(item.c ?? color);
    },
    [items, color],
  );
  return (
    <Instanced count={items.length} build={build} colored={colored} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry />
      <meshStandardMaterial color={colored ? '#ffffff' : color} roughness={roughness} metalness={metalness} />
    </Instanced>
  );
}

/** A straight member from one point to another, with an optional radius of its own. */
export type Segment = readonly [start: THREE.Vector3Tuple, end: THREE.Vector3Tuple, radius?: number];

interface StrutsProps {
  segments: readonly Segment[];
  /** Radius for segments that don't carry their own. */
  radius?: number;
  color: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  radialSegments?: number;
  castShadow?: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Round steel/concrete members between pairs of points, as one instanced mesh. */
export function Struts({ segments, radius = 0.15, color, roughness = 0.6, metalness = 0.15, radialSegments = 6, castShadow = true }: StrutsProps) {
  const build = useCallback<InstanceBuilder>(
    (i, object) => {
      const [start, end, own] = segments[i];
      const direction = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
      const length = direction.length();
      object.position.set((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2);
      if (length > 1e-6) object.quaternion.setFromUnitVectors(UP, direction.divideScalar(length));
      const r = own ?? radius;
      object.scale.set(r, Math.max(length, 1e-6), r);
    },
    [segments, radius],
  );
  return (
    <Instanced count={segments.length} build={build} castShadow={castShadow}>
      <cylinderGeometry args={[1, 1, 1, radialSegments, 1]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </Instanced>
  );
}
