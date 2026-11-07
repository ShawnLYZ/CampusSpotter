import { useMemo } from 'react';
import { DoubleSide, Vector2 } from 'three';
import { GREEN_ROOF, WHITE, zoneClick, type ZoneClick } from './shared.ts';

/** TM Stadium Nasional: lathe bowl (radius 18, height 8) with a pitch disc inside. */
export function Stadium({ onZoneClick, glowing = false }: { onZoneClick?: ZoneClick; glowing?: boolean }) {
  const profile = useMemo(
    () => [new Vector2(10, 0), new Vector2(12, 3), new Vector2(15.5, 6), new Vector2(18, 8), new Vector2(17.4, 8), new Vector2(15, 5.8), new Vector2(11.5, 3), new Vector2(9.5, 0.4)],
    [],
  );
  return (
    <group position={[-105, 0, 40]} onClick={zoneClick(onZoneClick, 'stadium')}>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[profile, 48]} />
        <meshStandardMaterial
          color={WHITE} roughness={0.9} side={DoubleSide} toneMapped={!glowing}
          emissive={glowing ? '#f59e0b' : '#000000'} emissiveIntensity={glowing ? 0.6 : 0}
        />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[10, 48]} />
        <meshStandardMaterial color={GREEN_ROOF} roughness={1} />
      </mesh>
    </group>
  );
}
