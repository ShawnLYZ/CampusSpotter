import { useMemo } from 'react';
import { DoubleSide, Shape } from 'three';
import { M, itemById } from '../layout.ts';
import { ROOF_METAL, WALL, insetRing, loftGeometry, roundedRing, smoothRing } from './materials.ts';
import { GREEN_ROOF, GREY, zoneClick, type ZoneClick } from './shared.ts';

/** Heights in metres: the top of the canopy and the raised plaza under it. */
const TOP = 35;
const PLAZA = 4.5;
/** The atrium faces the street corner: its stair, balconies and columns are laid out about the south-east diagonal. */
const AXIS = Math.PI / 4;

/**
 * The canopy in plan, in metres from the atrium's centre: a rounded triangle whose nose reaches for the street
 * corner, with one arm tucked under Block B's roof (west) and the other under the library's (north).
 */
const CANOPY: [number, number][] = [
  [-45.6, -20], [-45.6, 14], [-30, 22], [-8, 29], [14, 33], [30, 31], [38, 23], [41, 8],
  [40, -12], [36, -28], [28, -33.6], [-6, -33.6], [-24, -29], [-38, -26],
];

/** The three balcony levels above the plaza: each ring a little smaller, shifted and turned against the one below. */
const BALCONIES = [10, 15.5, 21];

/** The open entrance atrium: a canopy on tall columns over ringed balconies, a glazed drum and the grand stair. */
export function Atrium({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const item = itemById('atrium')!;

  const { canopy, slender } = useMemo(() => {
    const outline = smoothRing(CANOPY);
    const canopy = loftGeometry([
      { pts: insetRing(outline, 7), y: TOP - 2.6 },
      { pts: outline, y: TOP - 0.7 },
      { pts: outline, y: TOP },
      { pts: insetRing(outline, 6), y: TOP + 0.8 },
    ], { smooth: true });
    // Slender columns under the free edge of the canopy, on the two street sides only.
    const slender = insetRing(outline, 9).filter((p, i) => i % 9 === 0 && p.x + p.y > -8);
    return { canopy, slender };
  }, []);

  const { plaza, drum, levels, columns } = useMemo(() => {
    const solid = (pts: ReturnType<typeof roundedRing>, from: number, to: number) =>
      loftGeometry([{ pts, y: from }, { pts, y: to }], { smooth: true });
    const levels = BALCONIES.map((y, i) => {
      const ring = roundedRing(23.5 - i * 1.2, 17.5 - i, 2.5, i % 2 ? 2.4 : -2.4, i % 2 ? 0 : 3, (i - 1) * 0.16);
      const rail = insetRing(ring, 0.3);
      return { y, slab: solid(ring, 0, 1.3), rail: loftGeometry([{ pts: rail, y: 1.3 }, { pts: rail, y: 2.6 }], { smooth: true, caps: false }) };
    });
    return {
      plaza: solid(roundedRing(28, 21.5, 2.6, 0, 1), 0, PLAZA),
      drum: solid(roundedRing(15, 10.5, 2.4, 0, -1), PLAZA, TOP - 2.6),
      levels,
      columns: roundedRing(18.6, 13.4, 2.3, 0, 1.5, 0, 10),
    };
  }, []);

  return (
    <group position={[item.x, 0, item.z]} scale={M} onClick={zoneClick(onZoneClick, 'atrium')}>
      <mesh geometry={canopy} castShadow receiveShadow>
        <meshStandardMaterial color={ROOF_METAL} roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Roof light over the void */}
      <mesh position={[-10, TOP + 0.9, -8]} castShadow>
        <boxGeometry args={[16, 0.5, 10]} />
        <meshStandardMaterial color="#9aa0a4" roughness={0.6} metalness={0.4} />
      </mesh>
      {slender.map((p) => (
        <mesh key={`${p.x},${p.y}`} position={[p.x, (TOP - 2) / 2, p.y]} castShadow>
          <cylinderGeometry args={[0.65, 0.65, TOP - 2, 12]} />
          <meshStandardMaterial color={WALL} roughness={0.7} />
        </mesh>
      ))}

      <group rotation={[0, AXIS, 0]}>
        <mesh geometry={plaza} castShadow receiveShadow>
          <meshStandardMaterial color="#b8bbb7" roughness={0.8} />
        </mesh>
        {columns.map((p) => (
          <mesh key={`${p.x},${p.y}`} position={[p.x, (TOP - 2.4) / 2, p.y]} castShadow>
            <cylinderGeometry args={[1.15, 1.15, TOP - 2.4, 16]} />
            <meshStandardMaterial color={WALL} roughness={0.7} />
          </mesh>
        ))}
        <mesh geometry={drum}>
          <meshStandardMaterial color="#79b3ac" emissive="#bfe6dc" emissiveIntensity={0.12} roughness={0.1} metalness={0.35} transparent opacity={0.62} />
        </mesh>
        {levels.map(({ y, slab, rail }) => (
          <group key={y} position={[0, y, 0]}>
            <mesh geometry={slab} castShadow receiveShadow>
              <meshStandardMaterial color={WALL} roughness={0.8} />
            </mesh>
            <mesh geometry={rail}>
              <meshStandardMaterial color="#9fd6d8" roughness={0.1} metalness={0.3} transparent opacity={0.5} side={DoubleSide} />
            </mesh>
          </group>
        ))}

        {/* Grand stair from the forecourt up to the plaza, between two planters */}
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[0, (i + 1) * 0.25, 30 - i * 1.5]} castShadow receiveShadow>
            <boxGeometry args={[28 - i * 0.9, (i + 1) * 0.5, 1.5]} />
            <meshStandardMaterial color="#dcdcd7" roughness={0.9} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 17.5, 0, 25]}>
            <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
              <boxGeometry args={[5, 2.2, 7]} />
              <meshStandardMaterial color="#e3e3de" roughness={0.9} />
            </mesh>
            <mesh position={[0, 2.25, 0]}>
              <boxGeometry args={[4.2, 0.1, 6.2]} />
              <meshStandardMaterial color={GREEN_ROOF} roughness={1} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * The illuminated "APU" letters on the corner lawn. `x`, `z` in scene units; `size` is the letter height in metres;
 * `turn` is the direction the letters face, in radians from south towards east.
 */
export function ApuSign({ x, z, size = 6, turn = 0 }: { x: number; z: number; size?: number; turn?: number }) {
  const letters = useMemo(() => {
    const a = new Shape();
    a.moveTo(0, 0);
    a.lineTo(0.35, 1);
    a.lineTo(0.55, 1);
    a.lineTo(0.9, 0);
    a.lineTo(0.7, 0);
    a.lineTo(0.62, 0.25);
    a.lineTo(0.28, 0.25);
    a.lineTo(0.2, 0);
    const aHole = new Shape();
    aHole.moveTo(0.33, 0.42);
    aHole.lineTo(0.45, 0.8);
    aHole.lineTo(0.57, 0.42);
    a.holes.push(aHole);

    const p = new Shape();
    p.moveTo(0, 0);
    p.lineTo(0, 1);
    p.lineTo(0.42, 1);
    p.absarc(0.42, 0.7, 0.3, Math.PI / 2, -Math.PI / 2, true);
    p.lineTo(0.2, 0.4);
    p.lineTo(0.2, 0);
    const pHole = new Shape();
    pHole.moveTo(0.2, 0.57);
    pHole.lineTo(0.42, 0.57);
    pHole.absarc(0.42, 0.7, 0.13, -Math.PI / 2, Math.PI / 2, false);
    pHole.lineTo(0.2, 0.83);
    p.holes.push(pHole);

    const u = new Shape();
    u.moveTo(0, 1);
    u.lineTo(0, 0.35);
    u.absarc(0.35, 0.35, 0.35, Math.PI, Math.PI * 2, false);
    u.lineTo(0.7, 1);
    u.lineTo(0.5, 1);
    u.lineTo(0.5, 0.35);
    u.absarc(0.35, 0.35, 0.15, 0, -Math.PI, true);
    u.lineTo(0.2, 1);
    return [a, p, u];
  }, []);

  return (
    <group position={[x, 0.08, z]} rotation={[0, turn, 0]} scale={size * M} raycast={() => null}>
      {letters.map((shape, i) => (
        <mesh key={i} position={[i * 1.05 - 1.45, 0, 0]} castShadow raycast={() => null}>
          <extrudeGeometry args={[shape, { depth: 0.22, bevelEnabled: false }]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** The APU shuttle stop on the frontage road: the platform the bus pulls onto, and a shelter beside it. */
export function ShuttleStop({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const stop = itemById('apu-stop')!;
  return (
    <group position={[stop.x, 0, stop.z]} onClick={zoneClick(onZoneClick, 'apu-stop')}>
      <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
        <boxGeometry args={[4, 0.16, 2.4]} />
        <meshStandardMaterial color={GREY} />
      </mesh>
      <group position={[1.45, 0.16, 0]}>
        {[-0.95, 0.95].map((z) => (
          <mesh key={z} position={[0.3, 0.33, z]} castShadow>
            <boxGeometry args={[0.07, 0.66, 0.07]} />
            <meshStandardMaterial color="#8d9399" roughness={0.6} metalness={0.4} />
          </mesh>
        ))}
        <mesh position={[0.34, 0.3, 0]}>
          <boxGeometry args={[0.03, 0.5, 1.9]} />
          <meshStandardMaterial color="#9fd6d8" roughness={0.1} transparent opacity={0.45} />
        </mesh>
        <mesh position={[0, 0.69, 0]} castShadow>
          <boxGeometry args={[0.95, 0.06, 2.3]} />
          <meshStandardMaterial color={ROOF_METAL} roughness={0.45} metalness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
