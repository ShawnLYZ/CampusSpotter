import { useMemo } from 'react';
import { Shape } from 'three';
import { M, itemById } from '../layout.ts';
import { planShape, roundedPlan } from './materials.ts';
import { GREY, zoneClick, type ZoneClick } from './shared.ts';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
const CANOPY_Y = 38;
const PLAZA_Y = 4.2;

/** The open entrance atrium: a rounded canopy on tall columns over ringed balconies. Modelled in metres. */
export function Atrium({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const item = itemById('atrium')!;
  const canopy = useMemo(() => planShape(roundedPlan(40, 33)), []);
  const plaza = useMemo(() => planShape(roundedPlan(31, 25)), []);
  const drum = useMemo(() => planShape(roundedPlan(14.5, 10, 2.4, -3, -3)), []);

  const levels = useMemo(
    () => [9, 14.5, 20, 25.5].map((y, i) => {
      const rx = 25 - i * 1.6;
      const rz = 19 - i * 1.1;
      const cx = -3 + (i % 2 ? 2.5 : -1);
      const cz = -3 + (i % 2 ? -1 : 1.5);
      const outer = roundedPlan(rx, rz, 2.3, cx, cz);
      return {
        y,
        slab: planShape(outer, roundedPlan(13, 8.5, 2.3, -3, -3)),
        rail: planShape(outer, roundedPlan(rx - 0.25, rz - 0.25, 2.3, cx, cz)),
      };
    }),
    [],
  );

  const columns = useMemo(() => {
    const out: [number, number][] = [];
    for (const p of roundedPlan(34, 27.5, 2.8).filter((_, i) => i % 6 === 0)) {
      const cz = -p.y;
      // The back of the atrium meets the building, which carries the canopy there.
      if (cz > -12) out.push([p.x, cz]);
    }
    out.push([-6, 6], [8, 9], [14, -4]);
    return out;
  }, []);

  return (
    <group position={[item.x, 0, item.z]} scale={M} onClick={zoneClick(onZoneClick, 'atrium')}>
      <mesh rotation={FLAT} position={[0, CANOPY_Y, 0]} castShadow receiveShadow>
        <extrudeGeometry args={[canopy, { depth: 1.5, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.5, bevelSegments: 3 }]} />
        <meshStandardMaterial color="#e6e8e9" roughness={0.45} metalness={0.35} />
      </mesh>

      {columns.map(([cx, cz]) => (
        <mesh key={`${cx},${cz}`} position={[cx, CANOPY_Y / 2, cz]} castShadow>
          <cylinderGeometry args={[1.15, 1.15, CANOPY_Y, 16]} />
          <meshStandardMaterial color="#f1f1ee" roughness={0.7} />
        </mesh>
      ))}

      <mesh rotation={FLAT} position={[0, PLAZA_Y - 0.5, 0]} receiveShadow castShadow>
        <extrudeGeometry args={[plaza, { depth: 0.5, bevelEnabled: false }]} />
        <meshStandardMaterial color="#8d9296" roughness={0.35} metalness={0.2} />
      </mesh>

      {/* Grand stair from the forecourt up to the plaza */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[4, 0.3 + i * 0.6, 35.5 - i * 1.7]} castShadow receiveShadow>
          <boxGeometry args={[30 - i * 1.2, 0.6, 1.7 + (i === 6 ? 6 : 0)]} />
          <meshStandardMaterial color="#d8d8d3" roughness={0.9} />
        </mesh>
      ))}

      <mesh rotation={FLAT} position={[0, PLAZA_Y, 0]}>
        <extrudeGeometry args={[drum, { depth: 27, bevelEnabled: false }]} />
        <meshStandardMaterial color="#5fa6a3" roughness={0.1} metalness={0.45} transparent opacity={0.82} />
      </mesh>

      {levels.map(({ y, slab, rail }) => (
        <group key={y} position={[0, y, 0]}>
          <mesh rotation={FLAT} castShadow receiveShadow>
            <extrudeGeometry args={[slab, { depth: 0.7, bevelEnabled: false }]} />
            <meshStandardMaterial color="#efefec" roughness={0.8} />
          </mesh>
          <mesh rotation={FLAT} position={[0, 0.7, 0]}>
            <extrudeGeometry args={[rail, { depth: 1.3, bevelEnabled: false }]} />
            <meshStandardMaterial color="#8fd0d6" roughness={0.1} metalness={0.3} transparent opacity={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The illuminated "APU" letters on the forecourt. `x`, `z` in scene units; `size` is the letter height in metres. */
export function ApuSign({ x, z, size = 6 }: { x: number; z: number; size?: number }) {
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
    <group position={[x, 0.08, z]} scale={size * M} raycast={() => null}>
      {letters.map((shape, i) => (
        <mesh key={i} position={[i * 1.05, 0, 0]} castShadow raycast={() => null}>
          <extrudeGeometry args={[shape, { depth: 0.22, bevelEnabled: false }]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** The APU shuttle stop platform on the frontage road, in front of the atrium. */
export function ShuttleStop({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const stop = itemById('apu-stop')!;
  return (
    <mesh position={[stop.x, 0.08, stop.z]} receiveShadow castShadow onClick={zoneClick(onZoneClick, 'apu-stop')}>
      <boxGeometry args={[4, 0.16, 2.4]} />
      <meshStandardMaterial color={GREY} />
    </mesh>
  );
}
