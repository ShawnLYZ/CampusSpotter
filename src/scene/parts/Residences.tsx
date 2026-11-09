import { itemById, itemHeight } from '../layout.ts';
import { Block } from './Block.tsx';
import type { ZoneClick } from './shared.ts';

const TOWERS = ['residences-j', 'residences-k'] as const;

/** Footprint of each residence tower, for the selection outline. */
export function residenceBoxes(): { x: number; y: number; z: number; w: number; d: number; h: number }[] {
  return TOWERS.map((id) => {
    const it = itemById(id)!;
    return { x: it.x, y: 0, z: it.z, w: it.w ?? 6, d: it.d ?? 4, h: itemHeight(it) };
  });
}

/** The two tall rear blocks. A click on either reports the residences zone. */
export function Residences({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  return (
    <>
      {TOWERS.map((id) => <Block key={id} item={itemById(id)!} zoneId="residences" onZoneClick={onZoneClick} />)}
    </>
  );
}
