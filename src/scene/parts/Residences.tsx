import { useMemo } from 'react';
import { FLOOR_HEIGHT, M, itemById, itemHeight } from '../layout.ts';
import { Block } from './Block.tsx';
import { GLASS, ROOF_METAL, WALL, loftGeometry, roundedRing } from './materials.ts';
import { zoneClick, type ZoneClick } from './shared.ts';

const TOWERS = ['residences-j1', 'residences-j2', 'residences-k1', 'residences-k2'] as const;
/** The entrance canopy on the west street, where the shuttle buses also call: centre in scene units, height in metres. */
const LOBBY = { x: -20.1, z: -24.6, y: 6 };

/** Footprint of each residence tower, for the selection outline. */
export function residenceBoxes(): { x: number; y: number; z: number; w: number; d: number; h: number }[] {
  return TOWERS.map((id) => {
    const it = itemById(id)!;
    return { x: it.x, y: 0, z: it.z, w: it.w ?? 6, d: it.d ?? 4, h: itemHeight(it) };
  });
}

/** The flat roof of one tower: a set-back attic under a thin oversailing plate, and a glazed strip up each end wall. */
function Crown({ id }: { id: string }) {
  const it = itemById(id)!;
  const w = (it.w ?? 6) / M, d = (it.d ?? 4) / M, h = ((it.floors ?? 0) * FLOOR_HEIGHT) / M;
  return (
    <group position={[it.x, 0, it.z]} scale={M}>
      <mesh position={[0, h + 1.5, 0]}>
        <boxGeometry args={[w - 3, 1.6, d - 3]} />
        <meshStandardMaterial color="#aeb3b7" roughness={0.8} />
      </mesh>
      <mesh position={[0, h + 2.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 2.4, 0.4, d + 2.4]} />
        <meshStandardMaterial color={ROOF_METAL} roughness={0.5} metalness={0.3} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + 0.06), h * 0.52, 0]}>
          <boxGeometry args={[0.12, h * 0.84, 2.4]} />
          <meshStandardMaterial color={GLASS} roughness={0.2} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** The residences in the north-west: four slabs on a planted podium. A click on any of them reports the residences zone. */
export function Residences({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const disc = useMemo(() => {
    const ring = roundedRing(8.5, 7, 2.2);
    return loftGeometry([{ pts: ring, y: 0 }, { pts: ring, y: 0.6 }], { smooth: true });
  }, []);
  return (
    <group onClick={zoneClick(onZoneClick, 'residences')}>
      <Block item={itemById('residence-podium')!} zoneId="residences" onZoneClick={onZoneClick} />
      {TOWERS.map((id) => (
        <group key={id}>
          <Block item={itemById(id)!} zoneId="residences" onZoneClick={onZoneClick} />
          <Crown id={id} />
        </group>
      ))}
      <group position={[LOBBY.x, 0, LOBBY.z]} scale={M}>
        <mesh geometry={disc} position={[0, LOBBY.y, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={ROOF_METAL} roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[2.5, LOBBY.y / 2, 0]}>
          <cylinderGeometry args={[4.2, 4.2, LOBBY.y, 24]} />
          <meshStandardMaterial color={GLASS} roughness={0.1} metalness={0.4} transparent opacity={0.75} />
        </mesh>
        {[[-5.5, -3.5], [-5.5, 3.5], [1, -5.6], [1, 5.6]].map(([x, z]) => (
          <mesh key={`${x},${z}`} position={[x!, LOBBY.y / 2, z!]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, LOBBY.y, 10]} />
            <meshStandardMaterial color={WALL} roughness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
