import { FLOOR_HEIGHT, itemById } from '../layout.ts';
import { ApuSign, Atrium, ShuttleStop } from './Atrium.tsx';
import { Block } from './Block.tsx';
import { Grounds } from './Grounds.tsx';
import { GLASS } from './materials.ts';
import { Residences } from './Residences.tsx';
import { Sports } from './Sports.tsx';
import { zoneClick, type ZoneClick } from './shared.ts';

const BLOCKS = ['block-a', 'block-b', 'block-c', 'block-d', 'block-e', 'library', 'link'];

/** Glazed link bridges over the Spine, from each south block across to Block D, at two levels. */
function Bridges({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const d = itemById('block-d')!;
  const south = d.z + (d.d ?? 0) / 2;
  return (
    <group onClick={zoneClick(onZoneClick, 'spine')}>
      {['block-a', 'block-b'].flatMap((id) => {
        const it = itemById(id)!;
        const north = it.z - (it.d ?? 0) / 2;
        return [4, 6].map((floor) => (
          <mesh key={`${id}${floor}`} position={[it.x, (floor + 0.5) * FLOOR_HEIGHT, (north + south) / 2]} castShadow>
            <boxGeometry args={[0.7, FLOOR_HEIGHT * 0.8, north - south]} />
            <meshStandardMaterial color={GLASS} roughness={0.15} metalness={0.5} />
          </mesh>
        ));
      })}
    </group>
  );
}

/**
 * The APU campus exterior: the podium and academic blocks, the entrance atrium on the street corner, the sports
 * terraces, the residences and the grounds (with the forecourt car park).
 */
export function Campus({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  return (
    <>
      <Grounds onZoneClick={onZoneClick} />
      {/* The podium roof is the Spine; the blocks standing on it take their own clicks first. */}
      <Block item={itemById('podium')!} zoneId="spine" onZoneClick={onZoneClick} />
      {BLOCKS.map((id) => (
        <Block key={id} item={itemById(id)!} zoneId={id === 'link' ? 'library' : id} onZoneClick={onZoneClick} />
      ))}
      <Bridges onZoneClick={onZoneClick} />
      <Sports />
      <Residences onZoneClick={onZoneClick} />
      <Atrium onZoneClick={onZoneClick} />
      <ApuSign x={23.8} z={5.7} turn={Math.PI / 4} />
      <ShuttleStop onZoneClick={onZoneClick} />
    </>
  );
}
