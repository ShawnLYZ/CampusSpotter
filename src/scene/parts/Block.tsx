import { useMemo, type ReactNode } from 'react';
import { FLOOR_HEIGHT, type LayoutItem } from '../layout.ts';
import { GREEN_ROOF, GREY, LINE, WHITE, floorLinePositions, zoneClick, type ZoneClick } from './shared.ts';

export interface BlockProps {
  item: LayoutItem;
  /** Zone id reported on click (defaults to the item id). */
  zoneId?: string;
  onZoneClick?: ZoneClick;
  roof?: 'plate' | 'green' | 'none';
  /** Perforated facade: a grey panel with grid lines on the front (+z) face. */
  perforated?: boolean;
  children?: ReactNode;
}

/** Extruded white box with floor lines and (by default) a floating pitched roof plate. */
export function Block({ item, zoneId, onZoneClick, roof = 'plate', perforated = false, children }: BlockProps) {
  const w = item.w ?? 6, d = item.d ?? 6, floors = item.floors ?? 3;
  const h = floors * FLOOR_HEIGHT;
  const lines = useMemo(() => floorLinePositions(w, d, h, FLOOR_HEIGHT), [w, d, h]);
  const grid = useMemo(() => {
    if (!perforated) return null;
    const out: number[] = [];
    const z = d / 2 + 0.04, step = 0.35;
    for (let x = -w / 2 + 0.6; x <= w / 2 - 0.6 + 1e-6; x += step) out.push(x, 0.5, z, x, h - 0.4, z);
    for (let y = 0.5; y <= h - 0.4 + 1e-6; y += step) out.push(-w / 2 + 0.6, y, z, w / 2 - 0.6, y, z);
    return new Float32Array(out);
  }, [perforated, w, d, h]);

  return (
    <group position={[item.x, 0, item.z]} onClick={zoneClick(onZoneClick, zoneId ?? item.id)}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={WHITE} roughness={0.95} />
      </mesh>
      <lineSegments>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[lines, 3]} /></bufferGeometry>
        <lineBasicMaterial color={LINE} />
      </lineSegments>
      {perforated && grid && (
        <>
          <mesh position={[0, h / 2, d / 2 + 0.02]}>
            <planeGeometry args={[w - 1.2, h - 0.8]} />
            <meshStandardMaterial color="#c4c7c2" roughness={1} />
          </mesh>
          <lineSegments>
            <bufferGeometry><bufferAttribute attach="attributes-position" args={[grid, 3]} /></bufferGeometry>
            <lineBasicMaterial color="#aeb2ac" />
          </lineSegments>
        </>
      )}
      {roof === 'plate' && (
        <>
          {/* Recessed top storey, then a floating plate with a slight pitch. */}
          <mesh position={[0, h + 0.3, 0]} castShadow>
            <boxGeometry args={[w * 0.94, 0.6, d * 0.94]} />
            <meshStandardMaterial color={GREY} roughness={0.9} />
          </mesh>
          <mesh position={[0, h + 0.68, 0]} rotation={[0.03, 0, 0.015]} castShadow receiveShadow>
            <boxGeometry args={[w * 1.1, 0.14, d * 1.1]} />
            <meshStandardMaterial color={WHITE} roughness={0.9} />
          </mesh>
        </>
      )}
      {roof === 'green' && (
        <>
          <mesh position={[-w * 0.18, h + 0.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[w * 0.64, 0.3, d]} />
            <meshStandardMaterial color={GREEN_ROOF} roughness={1} />
          </mesh>
          <mesh position={[w * 0.32, h + 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[w * 0.36, 1.0, d]} />
            <meshStandardMaterial color={WHITE} roughness={0.95} />
          </mesh>
          <mesh position={[w * 0.32, h + 1.05, 0]} castShadow receiveShadow>
            <boxGeometry args={[w * 0.36 - 0.3, 0.12, d - 0.3]} />
            <meshStandardMaterial color={GREEN_ROOF} roughness={1} />
          </mesh>
        </>
      )}
      {children}
    </group>
  );
}
