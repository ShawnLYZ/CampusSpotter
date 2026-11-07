import { itemById } from '../layout.ts';
import { Block } from './Block.tsx';
import { GREY, type ZoneClick } from './shared.ts';

/** Library: a five-storey block with vertical fins along its front. */
export function Library({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const item = itemById('library')!;
  const w = item.w ?? 7, d = item.d ?? 7, floors = item.floors ?? 5;
  const fins = Array.from({ length: 8 }, (_, i) => -w / 2 + 0.5 + (i * (w - 1)) / 7);
  return (
    <Block item={item} onZoneClick={onZoneClick}>
      {fins.map((x, i) => (
        <mesh key={i} position={[x, floors * 0.35, d / 2 + 0.12]} castShadow>
          <boxGeometry args={[0.12, floors * 0.7 - 0.2, 0.24]} />
          <meshStandardMaterial color={GREY} />
        </mesh>
      ))}
    </Block>
  );
}
