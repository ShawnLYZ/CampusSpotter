import { itemById } from '../layout.ts';
import { ApuSign, Atrium, ShuttleStop } from './Atrium.tsx';
import { Block } from './Block.tsx';
import { CoveredCarPark } from './CarParks.tsx';
import { Grounds } from './Grounds.tsx';
import { Residences } from './Residences.tsx';
import type { ZoneClick } from './shared.ts';

const BLOCKS = ['block-a', 'block-b', 'block-c', 'block-d', 'block-e', 'library', 'link'];

/** The APU campus exterior: podium, academic blocks, entrance atrium, rear towers, car parks and grounds. */
export function Campus({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  return (
    <>
      <Grounds onZoneClick={onZoneClick} />
      {/* The podium roof is the Spine; the blocks standing on it take their own clicks first. */}
      <Block item={itemById('podium')!} zoneId="spine" onZoneClick={onZoneClick} />
      {BLOCKS.map((id) => (
        <Block key={id} item={itemById(id)!} zoneId={id === 'link' ? 'library' : id} onZoneClick={onZoneClick} />
      ))}
      <Residences onZoneClick={onZoneClick} />
      <Atrium onZoneClick={onZoneClick} />
      <ApuSign x={12} z={10.6} />
      <ShuttleStop onZoneClick={onZoneClick} />
      <CoveredCarPark onZoneClick={onZoneClick} />
    </>
  );
}
