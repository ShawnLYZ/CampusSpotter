import { FLOOR_HEIGHT, itemById } from '../layout.ts';
import { Block } from './Block.tsx';
import type { ZoneClick } from './shared.ts';

const TOWER_PAIRS = ['residences-j', 'residences-k'] as const;
/** Each layout item is drawn as two slabs, offset this far either side of its centre. */
const SLAB_OFFSETS = [-2.5, 2.5] as const;

/** Footprint of each tower pair (both slabs), for the selection outline; derived from the same constants as the slabs. */
export function residencePairBoxes(): { x: number; y: number; z: number; w: number; d: number; h: number }[] {
  return TOWER_PAIRS.map((id) => {
    const it = itemById(id)!;
    const w = it.w ?? 6, spread = SLAB_OFFSETS[1] - SLAB_OFFSETS[0];
    return { x: it.x + (SLAB_OFFSETS[0] + SLAB_OFFSETS[1]) / 2, y: 0, z: it.z, w: w + spread, d: it.d ?? 4, h: (it.floors ?? 0) * FLOOR_HEIGHT };
  });
}

/** Residence towers J1/J2 and K1/K2 (two slabs, 5 units apart). Clicks on any slab report the residences zone. */
export function Residences({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const slabs = TOWER_PAIRS.flatMap((id) => {
    const it = itemById(id)!;
    return SLAB_OFFSETS.map((dx, i) => ({ key: id + '-' + i, item: { ...it, id: id + '-' + i, x: it.x + dx } }));
  });
  return (
    <>
      {slabs.map((s) => <Block key={s.key} item={s.item} zoneId="residences" onZoneClick={onZoneClick} />)}
    </>
  );
}
