import { useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { BAY, M, type LayoutItem } from '../layout.ts';
import { facadeTexture, screenTexture } from './materials.ts';
import { zoneClick, type ZoneClick } from './shared.ts';

export interface BlockProps {
  item: LayoutItem;
  /** Zone id reported on click (defaults to the item id). */
  zoneId?: string;
  onZoneClick?: ZoneClick;
}

/** Storey height in metres. */
const FLOOR_M = 4;
const BAY_M = BAY / M;

/**
 * One campus building: a box with strip-window facades, optional metal sun screens, and (for the academic
 * blocks) a glazed top storey under an oversailing roof. Modelled in metres inside a group scaled by `M`.
 */
export function Block({ item, zoneId, onZoneClick }: BlockProps) {
  const w = (item.w ?? 6) / M, d = (item.d ?? 6) / M, floors = item.floors ?? 3;
  const { tint = '#ecece7', screens, pavilion = false, pitch = 0.03 } = item;
  const h = floors * FLOOR_M;

  const materials = useMemo(() => {
    const face = (length: number) => new MeshStandardMaterial({
      color: tint, map: facadeTexture(Math.max(1, Math.round(length / BAY_M)), floors), roughness: 0.85,
    });
    const cap = new MeshStandardMaterial({ color: '#cfcfca', roughness: 0.9 });
    const ew = face(d), ns = face(w);
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    return [ew, ew, cap, cap, ns, ns];
  }, [tint, w, d, floors]);

  const screenMaterial = useMemo(
    () => new MeshStandardMaterial({ color: '#dfe1e2', map: screenTexture(1, floors * 3), roughness: 0.55, metalness: 0.35 }),
    [floors],
  );

  return (
    <group position={[item.x, 0, item.z]} scale={M} onClick={zoneClick(onZoneClick, zoneId ?? item.id)}>
      <mesh position={[0, h / 2, 0]} material={materials} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>

      {screens?.map((side) => {
        const onZ = side === 'n' || side === 's';
        const along = onZ ? w : d;
        const out = (onZ ? d : w) / 2 + 0.7;
        const sign = side === 's' || side === 'e' ? 1 : -1;
        return (
          <mesh key={side} material={screenMaterial} castShadow
            position={[onZ ? 0 : sign * out, h * 0.56, onZ ? sign * out : 0]}
            rotation={[0, onZ ? 0 : Math.PI / 2, 0]}>
            <boxGeometry args={[along * 0.78, h * 0.76, 0.5]} />
          </mesh>
        );
      })}

      {pavilion && (
        <>
          <mesh position={[0, h + 2.4, 0]} castShadow>
            <boxGeometry args={[w - 5, 4.8, d - 5]} />
            <meshStandardMaterial color="#6f979c" roughness={0.15} metalness={0.5} />
          </mesh>
          <mesh position={[0, h + 5.4, 0]} rotation={w >= d ? [pitch, 0, 0] : [0, 0, pitch]} castShadow receiveShadow>
            <boxGeometry args={[w + 7, 0.7, d + 7]} />
            <meshStandardMaterial color="#e3e5e6" roughness={0.45} metalness={0.4} />
          </mesh>
        </>
      )}
    </group>
  );
}
