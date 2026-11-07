import { useMemo } from 'react';
import { DoubleSide, Shape } from 'three';
import { itemById } from '../layout.ts';
import { Block } from './Block.tsx';
import { GREY, WHITE, zoneClick, type ZoneClick } from './shared.ts';

const CANOPY_Y = 5;

/** Centre Point and Atrium (low block) under a curved canopy arc, with the APU shuttle stop platform. */
export function Canopy({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const atrium = itemById('atrium')!;
  const canopy = itemById('canopy')!;
  const stop = itemById('apu-stop')!;
  const r = canopy.radius ?? 9;

  // Sector facing south/east (scene angles -40 to 140 deg). rotation-x -PI/2 maps shape (x, y) to scene (x, -y).
  const shape = useMemo(() => {
    const s = new Shape();
    const a0 = (-40 * Math.PI) / 180, a1 = (140 * Math.PI) / 180;
    s.moveTo(0, 0);
    for (let i = 0; i <= 24; i++) {
      const a = a0 + ((a1 - a0) * i) / 24;
      s.lineTo(Math.cos(a) * r, -Math.sin(a) * r);
    }
    s.lineTo(0, 0);
    return s;
  }, [r]);

  const columns: [number, number][] = [-30, 10, 50, 90, 130].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [Math.cos(a) * (r - 0.8), Math.sin(a) * (r - 0.8)];
  });

  return (
    <>
      <Block item={atrium} onZoneClick={onZoneClick} roof="none" />
      {/* The canopy ignores pointer events so clicks fall through to the atrium or the stop below. */}
      <mesh position={[canopy.x, CANOPY_Y, canopy.z]} rotation-x={-Math.PI / 2} castShadow receiveShadow
        raycast={() => null}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color={WHITE} roughness={0.9} side={DoubleSide} />
      </mesh>
      {columns.map(([dx, dz], i) => (
        <mesh key={i} position={[canopy.x + dx, CANOPY_Y / 2, canopy.z + dz]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, CANOPY_Y, 6]} />
          <meshStandardMaterial color={GREY} />
        </mesh>
      ))}
      <mesh position={[stop.x, 0.08, stop.z]} receiveShadow castShadow onClick={zoneClick(onZoneClick, 'apu-stop')}>
        <boxGeometry args={[4, 0.16, 2.4]} />
        <meshStandardMaterial color={GREY} />
      </mesh>
    </>
  );
}
