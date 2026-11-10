import { useMemo } from 'react';
import * as THREE from 'three';
import { STADIUM } from '../siteLayout.ts';

const SEGMENTS = 180;
/** Every Nth angular segment is left as a concrete stair aisle. */
const AISLE_EVERY = 12;

type Kind = 'board' | 'seat' | 'riser' | 'box' | 'aisle' | 'top';

interface ProfilePoint {
  /** Fraction of the way from the pitch-side edge to the back of the stand. */
  t: number;
  y: number;
  /** What the surface running from the previous point to this one is. */
  kind: Kind;
  row: number;
  tier: number;
}

/**
 * The stand's cross-section as a staircase: pitch-side wall, lower tier,
 * the dark band of boxes, then the steep upper tier up to the back wall.
 */
function buildProfile(): ProfilePoint[] {
  const points: ProfilePoint[] = [{ t: 0, y: 0, kind: 'board', row: 0, tier: 0 }];
  let t = 0;
  let y = 3.2;
  points.push({ t, y, kind: 'board', row: 0, tier: 0 });

  const lowerRows = 26;
  const lowerDepth = 0.36;
  const lowerRise = 8.3;
  for (let row = 0; row < lowerRows; row++) {
    t = ((row + 1) / lowerRows) * lowerDepth;
    points.push({ t, y, kind: 'seat', row, tier: 0 });
    if (row < lowerRows - 1) {
      y += lowerRise / lowerRows;
      points.push({ t, y, kind: 'riser', row: row + 1, tier: 0 });
    }
  }

  y = 15.6;
  points.push({ t, y, kind: 'box', row: 0, tier: 0 });
  const upperStart = 0.405;
  t = upperStart;
  points.push({ t, y, kind: 'aisle', row: 0, tier: 1 });

  const upperRows = 40;
  const upperEnd = 0.965;
  const upperRise = 23;
  for (let row = 0; row < upperRows; row++) {
    y += upperRise / upperRows;
    points.push({ t, y, kind: 'riser', row, tier: 1 });
    t = upperStart + ((row + 1) / upperRows) * (upperEnd - upperStart);
    points.push({ t, y, kind: 'seat', row, tier: 1 });
  }

  points.push({ t, y: STADIUM.wallTopY, kind: 'top', row: 0, tier: 1 });
  points.push({ t: 1, y: STADIUM.wallTopY, kind: 'top', row: 0, tier: 1 });
  return points;
}

const YELLOW = new THREE.Color('#f1b81b');
const CHARCOAL = new THREE.Color('#2a2b2f');
const CONCRETE = new THREE.Color('#a4a6a8');
const FIXED: Record<Exclude<Kind, 'seat' | 'riser'>, THREE.Color> = {
  board: new THREE.Color('#17274a'),
  box: new THREE.Color('#1c232d'),
  aisle: CONCRETE,
  top: new THREE.Color('#b2b4b5'),
};

/** Cheap repeatable noise in [0, 1) from two integers. */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Yellow seats broken by diagonal charcoal streaks — the tiger-stripe
 * scheme installed in the 2017 refurbishment.
 */
function seatColor(segment: number, row: number, tier: number, out: THREE.Color): THREE.Color {
  if (segment % AISLE_EVERY === 0) return out.copy(CONCRETE);
  const angle = (segment / SEGMENTS) * Math.PI * 2;
  const streak = Math.sin(angle * 22 + row * 0.42 + tier * 1.7) + 0.55 * Math.sin(angle * 53 - row * 0.8) + (hash(segment, row + tier * 97) - 0.5) * 0.5;
  out.copy(streak > 0.5 ? CHARCOAL : YELLOW);
  return out.multiplyScalar(0.92 + hash(row, segment) * 0.12);
}

function buildGeometry(): THREE.BufferGeometry {
  const profile = buildProfile();
  const { bowlInnerRx, bowlInnerRz, bowlOuterRx, bowlOuterRz } = STADIUM;
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();

  const vertex = (segment: number, point: ProfilePoint) => {
    const angle = (segment / SEGMENTS) * Math.PI * 2;
    positions.push(
      Math.cos(angle) * THREE.MathUtils.lerp(bowlInnerRx, bowlOuterRx, point.t),
      point.y,
      Math.sin(angle) * THREE.MathUtils.lerp(bowlInnerRz, bowlOuterRz, point.t),
    );
    colors.push(color.r, color.g, color.b);
  };

  for (let segment = 0; segment < SEGMENTS; segment++) {
    for (let k = 1; k < profile.length; k++) {
      const from = profile[k - 1];
      const to = profile[k];
      if (to.kind === 'seat') seatColor(segment, to.row, to.tier, color);
      // A riser shows the backs of the seats in front of it, so tint it to match, in shade.
      else if (to.kind === 'riser') seatColor(segment, to.row, to.tier, color).multiplyScalar(0.55);
      else color.copy(FIXED[to.kind]);

      // Two triangles per facet, wound so treads face up and risers face the pitch.
      vertex(segment, from);
      vertex(segment + 1, from);
      vertex(segment, to);
      vertex(segment + 1, from);
      vertex(segment + 1, to);
      vertex(segment, to);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The stepped seating tiers, built as one vertex-coloured mesh. */
export function SeatingBowl() {
  const geometry = useMemo(buildGeometry, []);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  );
}
