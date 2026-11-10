import * as THREE from 'three';
import type { XZ } from '../siteLayout.ts';

export interface SweepOptions {
  /** Join the last profile point back to the first, giving a solid section. */
  closed?: boolean;
  /** Metres of curve per unit of the V texture coordinate. */
  vScale?: number;
}

/**
 * Sweeps a cross-section along a ground-plan curve.
 *
 * Each profile point is [lateral offset, height]. Positive offsets lie to the
 * left of the direction of travel. The section stays upright (no Frenet
 * twisting), which is what roads, decks and kerbs need. List a closed profile
 * clockwise as seen looking back along the curve — across the top from
 * negative to positive offset, then down and back underneath — and the faces
 * point outwards.
 */
export function sweepGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  profile: readonly XZ[],
  samples: number,
  { closed = false, vScale = 1 }: SweepOptions = {},
): THREE.BufferGeometry {
  const length = curve.getLength();
  const offsets = profile.map((p) => p[0]);
  const minOffset = Math.min(...offsets);
  const span = Math.max(...offsets) - minOffset || 1;

  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    curve.getPointAt(u, point);
    curve.getTangentAt(u, tangent);
    tangent.y = 0;
    tangent.normalize();
    const sideX = tangent.z;
    const sideZ = -tangent.x;
    rings.push(profile.map(([offset, height]) => new THREE.Vector3(point.x + sideX * offset, point.y + height, point.z + sideZ * offset)));
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const edges = closed ? profile.length : profile.length - 1;
  for (let i = 0; i < samples; i++) {
    const v0 = ((i / samples) * length) / vScale;
    const v1 = (((i + 1) / samples) * length) / vScale;
    for (let j = 0; j < edges; j++) {
      const k = (j + 1) % profile.length;
      const a = rings[i][j];
      const b = rings[i + 1][j];
      const c = rings[i + 1][k];
      const d = rings[i][k];
      const uj = (profile[j][0] - minOffset) / span;
      const uk = (profile[k][0] - minOffset) / span;
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
      uvs.push(uj, v0, uj, v1, uk, v0, uj, v1, uk, v1, uk, v0);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Flat, upward-facing polygon on the ground from world/local XZ points.
 * UVs are the XZ coordinates in metres, so a repeating texture tiles by size.
 */
export function flatShapeGeometry(outline: readonly XZ[], holes: readonly (readonly XZ[])[] = []): THREE.BufferGeometry {
  const toShapeSpace = ([x, z]: XZ) => new THREE.Vector2(x, -z);
  const shape = new THREE.Shape(outline.map(toShapeSpace));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(toShapeSpace)));
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function ellipseOutline(rx: number, rz: number, segments = 96): XZ[] {
  return Array.from({ length: segments }, (_, i) => {
    const angle = (i / segments) * Math.PI * 2;
    return [Math.cos(angle) * rx, Math.sin(angle) * rz] as const;
  });
}

/** Closed 3D curve round an ellipse at a fixed height. */
export function ellipseCurve(rx: number, rz: number, y: number, segments = 96): THREE.CatmullRomCurve3 {
  const points = ellipseOutline(rx, rz, segments).map(([x, z]) => new THREE.Vector3(x, y, z));
  return new THREE.CatmullRomCurve3(points, true);
}

/** Unit outward normal of an ellipse at parameter `angle`, as [nx, nz]. */
export function ellipseNormal(rx: number, rz: number, angle: number): XZ {
  const nx = Math.cos(angle) / rx;
  const nz = Math.sin(angle) / rz;
  const length = Math.hypot(nx, nz);
  return [nx / length, nz / length];
}

/** `rotation.y` that turns an object's local +X onto the ground direction (dx, dz). */
export function yawTowards(dx: number, dz: number): number {
  return Math.atan2(-dz, dx);
}
