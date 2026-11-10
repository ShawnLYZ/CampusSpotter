import { Edges } from '@react-three/drei';
import { Color } from 'three';
import { SPINE_DECK, itemById, itemHeight } from '../layout.ts';
import { LRT_BAY, STADIUM_AT, STADIUM_CLEAR_RADIUS, STATION_BOX } from '../bukitJalil/placement.ts';
import type { PressureStyle } from '../pressureStyle.ts';
import type { Zone } from '../zones.ts';
import { residenceBoxes } from './Residences.tsx';

const SELECTED = '#ffffff';
const noRaycast = () => null;

interface Box { x: number; y: number; z: number; w: number; d: number; h: number }

/** Footprint boxes to outline, keyed by zone id. Road, stop and bay zones use other visuals. */
function boxFor(zone: Zone): Box | null {
  if (zone.id === 'spine') {
    const s = itemById('spine')!;
    return { x: s.x, y: SPINE_DECK.y, z: s.z, w: s.w ?? 0, d: s.d ?? 0, h: 0.3 };
  }
  if (zone.id === 'lrt-station') return STATION_BOX;
  if (zone.id === 'apu-stop') return null; // the stop shows its ring only
  const it = itemById(zone.id);
  if (!it || zone.outline === 'path') return null;
  return { x: it.x, y: 0, z: it.z, w: it.w ?? 6, d: it.d ?? 6, h: itemHeight(it) };
}

/** Selection footprint of a flat or low layout item. */
function itemBox(id: string, h: number): Box {
  const it = itemById(id)!;
  return { x: it.x, y: 0, z: it.z, w: it.w ?? 0, d: it.d ?? 0, h };
}

/** Ring decals on the ground for the shuttle stop and the LRT bay pad. */
const RINGS: Record<string, [number, number][]> = { 'apu-stop': [[16, 13]], 'lrt-station': [[LRT_BAY[0], LRT_BAY[1]]] };

/** Glowing colour: brightened past 1 so the unlit-tonemapped outline reads as emissive without bloom. */
const glowColor = (hex: string, glow: number) => new Color(hex).multiplyScalar(1 + glow);

function BoxOutline({ box, color, margin = 0.15 }: { box: Box; color: Color | string; margin?: number }) {
  return (
    <mesh position={[box.x, box.y + box.h / 2, box.z]} raycast={noRaycast}>
      <boxGeometry args={[box.w + margin, box.h + margin, box.d + margin]} />
      <meshBasicMaterial visible={false} />
      <Edges color={color} toneMapped={false} raycast={noRaycast} />
    </mesh>
  );
}

function Ring({ x, z, color, radius, y = 0.12 }: { x: number; z: number; color: Color | string; radius: number; y?: number }) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
      <ringGeometry args={[radius - 0.3, radius, 48]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

/** Footprints for zones without metrics, which only ever show a selection outline. */
const SELECT_BOXES: Record<string, Box[]> = {
  residences: residenceBoxes(),
  'carpark-b': [itemBox('carpark-b', 0.4)],
  'mranti-parking': [{ x: 45, y: 0, z: 30, w: 25, d: 15, h: 0.15 }],
};

/** White selection outline for a zone that has no pressure: boxes for buildings and lots, a ring for the stadium. */
function SelectionOnly({ zone }: { zone: Zone }) {
  if (zone.id === 'stadium') return <Ring x={STADIUM_AT[0]} z={STADIUM_AT[1]} color={SELECTED} radius={STADIUM_CLEAR_RADIUS} y={0.15} />;
  return <>{SELECT_BOXES[zone.id]?.map((b) => <BoxOutline key={`${b.x},${b.z}`} box={b} color={SELECTED} margin={0.5} />)}</>;
}

/** Glowing outline + floor tint (boxes), or ring decal (stop/bay). Road segments glow through their own material. */
export function ZoneHighlight({ zone, style, selected, hidden = false }: { zone: Zone; style: PressureStyle; selected: boolean; hidden?: boolean }) {
  if (zone.metrics.length === 0) return selected && !hidden ? <SelectionOnly zone={zone} /> : null;
  if (zone.outline === 'path') return null;
  const box = boxFor(zone);
  const rings = RINGS[zone.id];
  const color = glowColor(style.color, style.glow);
  return (
    <group>
      {box && (
        <>
          <BoxOutline box={box} color={color} />
          <mesh position={[box.x, box.y === 0 ? 0.04 : box.y + 0.02, box.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
            <planeGeometry args={[box.w + 3, box.d + 3]} />
            <meshBasicMaterial color={style.color} transparent opacity={style.tintOpacity} depthWrite={false} toneMapped={false} />
          </mesh>
          {selected && <BoxOutline box={box} color={SELECTED} margin={0.5} />}
        </>
      )}
      {rings?.map(([x, z]) => (
        <group key={`${x},${z}`}>
          <Ring x={x} z={z} color={color} radius={2.6} />
          <mesh position={[x, 0.1, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
            <circleGeometry args={[2.6, 48]} />
            <meshBasicMaterial color={style.color} transparent opacity={style.tintOpacity} depthWrite={false} toneMapped={false} />
          </mesh>
          {selected && <Ring x={x} z={z} color={SELECTED} radius={3.4} y={0.14} />}
        </group>
      ))}
    </group>
  );
}
