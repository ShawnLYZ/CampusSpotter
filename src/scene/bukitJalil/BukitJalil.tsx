import { memo } from 'react';
import { zoneClick, type ZoneClick } from '../parts/shared.ts';
import { LrtStation } from './lrt/LrtStation.tsx';
import { Trains } from './lrt/Trains.tsx';
import { Viaduct } from './lrt/Viaduct.tsx';
import { LRT_BAY, SITE_ROTATION_Y, SITE_SCALE, STADIUM_AT, STADIUM_HEIGHT, STATION_CLICK_BOXES } from './placement.ts';
import { STADIUM } from './siteLayout.ts';
import { Stadium } from './stadium/Stadium.tsx';

/** The detailed model. Memoised and free of handlers, so playback never rebuilds it and pointer events never raycast it. */
const Model = memo(function Model({ glowing }: { glowing: boolean }) {
  return (
    <group position={[STADIUM_AT[0], 0, STADIUM_AT[1]]} rotation={[0, SITE_ROTATION_Y, 0]} scale={SITE_SCALE}>
      <Stadium glowing={glowing} />
      <LrtStation />
      <Viaduct />
      <Trains />
    </group>
  );
});

/**
 * LRT Bukit Jalil and Stadium Nasional. Clicks are taken by simple invisible volumes for each zone,
 * rather than by the model's own meshes.
 */
export function BukitJalil({ onZoneClick, glowing = false }: { onZoneClick?: ZoneClick; glowing?: boolean }) {
  const stadiumRx = (STADIUM.rx + 3) * SITE_SCALE, stadiumRz = (STADIUM.rz + 3) * SITE_SCALE;
  return (
    <>
      <Model glowing={glowing} />
      <mesh position={[STADIUM_AT[0], STADIUM_HEIGHT / 2, STADIUM_AT[1]]} rotation={[0, SITE_ROTATION_Y, 0]}
        scale={[stadiumRx, STADIUM_HEIGHT, stadiumRz]} onClick={zoneClick(onZoneClick, 'stadium')}>
        <cylinderGeometry args={[1, 1, 1, 48]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <group onClick={zoneClick(onZoneClick, 'lrt-station')}>
        {STATION_CLICK_BOXES.map((box) => (
          <mesh key={box.z} position={[box.x, box.y + box.h / 2, box.z]}>
            <boxGeometry args={[box.w, box.h, box.d]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        ))}
        {/* Shuttle bay pad. */}
        <mesh position={[LRT_BAY[0], 0.05, LRT_BAY[1]]} receiveShadow>
          <boxGeometry args={[6, 0.1, 4]} />
          <meshStandardMaterial color="#c3c6c1" roughness={1} />
        </mesh>
      </group>
    </>
  );
}
