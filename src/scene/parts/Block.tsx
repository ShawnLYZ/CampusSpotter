import { useLayoutEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { type InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { BAY, FLOOR_HEIGHT, M, type Facade, type LayoutItem, type Side, type Span } from '../layout.ts';
import { GLASS, ROOF_CAP, ROOF_METAL, SCREEN, WALL, roofGeometry, tileTexture } from './materials.ts';
import { GREEN_ROOF, zoneClick, type ZoneClick } from './shared.ts';

export interface BlockProps {
  item: LayoutItem;
  /** Zone id reported on click (defaults to the item id). `null` for a building that is not a zone: it swallows the click. */
  zoneId?: string | null;
  onZoneClick?: ZoneClick;
}

/** Storey height and bay width in metres. */
const FLOOR_M = FLOOR_HEIGHT / M;
const BAY_M = BAY / M;
/** Width in metres of one texture cell of each facade. */
const CELL: Record<Facade, number> = { strip: BAY_M, punched: 3.6, glass: BAY_M, fins: 6, plain: 6 };
/** The glazed top storey, and how far the roof oversails the walls. */
const PAVILION_M = 4.8;
const OVERHANG = 4.5;
const SIDES: Side[] = ['n', 's', 'e', 'w'];

const swallow = (e: ThreeEvent<MouseEvent>) => e.stopPropagation();
const repeats = (length: number, cell: number) => Math.max(1, Math.round(length / cell));

/** Where a stretch of facade sits: its centre and length along the wall, and the wall's outward direction. */
function place(side: Side, [from, to]: Span, w: number, d: number) {
  const onZ = side === 'n' || side === 's';
  const wall = onZ ? w : d;
  return {
    onZ, out: side === 's' || side === 'e' ? 1 : -1, half: (onZ ? d : w) / 2,
    centre: ((from + to) / 2 - 0.5) * wall, length: (to - from) * wall,
  };
}

/** Box materials (+x, -x, +y, -y, +z, -z) with `ew` on the east and west faces and `ns` on the north and south. */
function boxMaterials(ew: MeshStandardMaterial, ns: MeshStandardMaterial, cap: MeshStandardMaterial) {
  return [ew, ew, cap, cap, ns, ns];
}

/** A perforated metal sun screen standing off one facade. */
function Screen({ side, span, w, d, from, to }: { side: Side; span: Span; w: number; d: number; from: number; to: number }) {
  const { onZ, out, half, centre, length } = place(side, span, w, d);
  const height = to - from;
  const material = useMemo(
    () => new MeshStandardMaterial({ color: SCREEN, map: tileTexture('screen', repeats(length, 3), repeats(height, 3)), roughness: 0.5, metalness: 0.3 }),
    [length, height],
  );
  const off = out * (half + 1.4);
  return (
    <mesh material={material} castShadow receiveShadow
      position={[onZ ? centre : off, from + height / 2, onZ ? off : centre]} rotation={[0, onZ ? 0 : Math.PI / 2, 0]}>
      <boxGeometry args={[length, height, 0.35]} />
    </mesh>
  );
}

/** A stair or lift core: a white tower with small windows on its outer face, standing proud of the wall. */
function Core({ side, span, w, d, height }: { side: Side; span: Span; w: number; d: number; height: number }) {
  const { onZ, out, half, centre, length } = place(side, span, w, d);
  const materials = useMemo(() => {
    const plain = new MeshStandardMaterial({ color: WALL, roughness: 0.85 });
    const face = new MeshStandardMaterial({ color: WALL, map: tileTexture('punched', repeats(length, CELL.punched), height / FLOOR_M), roughness: 0.85 });
    const all = [plain, plain, plain, plain, plain, plain];
    all[(onZ ? 4 : 0) + (out > 0 ? 0 : 1)] = face;
    return all;
  }, [onZ, out, length, height]);
  const depth = 2.2, off = out * (half + 0.9 - depth / 2);
  return (
    <mesh material={materials} castShadow receiveShadow position={[onZ ? centre : off, height / 2, onZ ? off : centre]}>
      <boxGeometry args={onZ ? [length, height, depth] : [depth, height, length]} />
    </mesh>
  );
}

/** The slim posts that carry the roof, one per bay round the top of the walls. */
function Posts({ w, d, y, height }: { w: number; d: number; y: number; height: number }) {
  const ref = useRef<InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    const nx = Math.max(2, repeats(w, BAY_M)), nz = Math.max(2, repeats(d, BAY_M));
    for (const s of [-1, 1]) {
      for (let i = 0; i <= nx; i++) out.push([(i / nx - 0.5) * (w - 0.6), (s * (d - 0.6)) / 2]);
      for (let i = 1; i < nz; i++) out.push([(s * (w - 0.6)) / 2, (i / nz - 0.5) * (d - 0.6)]);
    }
    return out;
  }, [w, d]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    spots.forEach(([x, z], i) => {
      o.position.set(x, y + height / 2, z);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [spots, y, height]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} castShadow>
      <boxGeometry args={[0.4, height, 0.4]} />
      <meshStandardMaterial color={WALL} roughness={0.8} />
    </instancedMesh>
  );
}

/**
 * One campus building, modelled in metres inside a group scaled by `M`: walls in the item's facade, optional sun
 * screens and cores, and either a glazed top storey under an oversailing roof or a flat roof behind a parapet.
 * A `strip` (academic) block stands on a recessed, glazed ground floor.
 */
export function Block({ item, zoneId, onZoneClick }: BlockProps) {
  const w = (item.w ?? 6) / M, d = (item.d ?? 6) / M, floors = item.floors ?? 3;
  const { tint = WALL, facade = 'strip', pavilion = false, green = false, ends } = item;
  const h = floors * FLOOR_M;
  const y0 = facade === 'strip' ? FLOOR_M : 0;

  const body = useMemo(() => {
    const rows = facade === 'punched' ? Math.round(h / 3.2) : (h - y0) / FLOOR_M;
    const wall = (length: number) => new MeshStandardMaterial({ color: tint, map: tileTexture(facade, repeats(length, CELL[facade]), rows), roughness: 0.85 });
    const cap = new MeshStandardMaterial({ color: green ? GREEN_ROOF : ROOF_CAP, roughness: 0.95 });
    return boxMaterials(ends ? new MeshStandardMaterial({ color: ends, roughness: 0.9 }) : wall(d), wall(w), cap);
  }, [tint, facade, w, d, h, y0, green, ends]);

  const base = useMemo(() => {
    if (!y0) return null;
    const wall = (length: number) => new MeshStandardMaterial({ color: '#ffffff', map: tileTexture('base', repeats(length, BAY_M), 1), roughness: 0.4, metalness: 0.2 });
    return boxMaterials(wall(d), wall(w), new MeshStandardMaterial({ color: ROOF_CAP }));
  }, [w, d, y0]);

  const roof = useMemo(() => (pavilion ? roofGeometry(w + 2 * OVERHANG, d + 2 * OVERHANG) : null), [pavilion, w, d]);
  const parapet = !pavilion && item.kind !== 'podium';

  return (
    <group position={[item.x, 0, item.z]} scale={M} onClick={zoneId === null ? swallow : zoneClick(onZoneClick, zoneId ?? item.id)}>
      {base && (
        <mesh position={[0, y0 / 2, 0]} material={base} receiveShadow>
          <boxGeometry args={[w - 1.8, y0, d - 1.8]} />
        </mesh>
      )}
      <mesh position={[0, (h + y0) / 2, 0]} material={body} castShadow receiveShadow>
        <boxGeometry args={[w, h - y0, d]} />
      </mesh>

      {SIDES.map((side) => {
        const span = item.screens?.[side];
        return span && <Screen key={side} side={side} span={span} w={w} d={d} from={y0 + FLOOR_M} to={h - 0.8} />;
      })}
      {SIDES.flatMap((side) => (item.cores?.[side] ?? []).map((span) => (
        <Core key={`${side}${span[0]}`} side={side} span={span} w={w} d={d} height={h + (pavilion ? 3 : 0.6)} />
      )))}

      {roof && (
        <>
          <mesh position={[0, h + PAVILION_M / 2, 0]} castShadow>
            <boxGeometry args={[w - 5, PAVILION_M, d - 5]} />
            <meshStandardMaterial color={GLASS} roughness={0.15} metalness={0.5} />
          </mesh>
          <Posts w={w} d={d} y={h} height={PAVILION_M} />
          <mesh geometry={roof} position={[0, h + PAVILION_M, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={ROOF_METAL} roughness={0.45} metalness={0.4} />
          </mesh>
        </>
      )}
      {parapet && (
        <>
          <mesh position={[0, h + 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[w + 0.8, 0.7, d + 0.8]} />
            <meshStandardMaterial color={tint} roughness={0.85} />
          </mesh>
          <mesh position={[0, h + 0.72, 0]} receiveShadow>
            <boxGeometry args={[w - 1, 0.1, d - 1]} />
            <meshStandardMaterial color={green ? GREEN_ROOF : ROOF_CAP} roughness={0.95} />
          </mesh>
        </>
      )}
    </group>
  );
}
