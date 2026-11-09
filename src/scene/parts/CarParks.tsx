import { useMemo } from 'react';
import { itemById } from '../layout.ts';
import { GREY, LINE, WHITE, floorLinePositions, zoneClick, type ZoneClick } from './shared.ts';

const DECK = 0.7;

/** Car park Zone A: a covered structure of three decks. (Zone B, the open forecourt bays, is part of `Grounds`.) */
export function CoveredCarPark({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const it = itemById('carpark-a')!;
  const w = it.w ?? 10, d = it.d ?? 10, floors = it.floors ?? 3;
  const h = floors * DECK;
  const lines = useMemo(() => floorLinePositions(w, d, h + 0.01, DECK, 0.03), [w, d, h]);
  const decks = Array.from({ length: floors }, (_, i) => i);
  const posts: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]];
  return (
    <group position={[it.x, 0, it.z]} onClick={zoneClick(onZoneClick, 'carpark-a')}>
      {decks.map((i) => (
        <mesh key={i} position={[0, DECK * (i + 1) - 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.2, d]} />
          <meshStandardMaterial color={WHITE} roughness={0.95} />
        </mesh>
      ))}
      {posts.map(([sx, sz], i) => (
        <mesh key={i} position={[(sx * (w - 0.4)) / 2, h / 2, (sz * (d - 0.4)) / 2]} castShadow>
          <boxGeometry args={[0.35, h, 0.35]} />
          <meshStandardMaterial color={GREY} />
        </mesh>
      ))}
      <lineSegments>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[lines, 3]} /></bufferGeometry>
        <lineBasicMaterial color={LINE} />
      </lineSegments>
    </group>
  );
}
