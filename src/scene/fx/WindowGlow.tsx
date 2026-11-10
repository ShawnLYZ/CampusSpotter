import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import type { Forecast } from '@engine/output.ts';
import type { BlockId } from '@engine/types.ts';
import { seededRandom } from '../../lib/random.ts';
import { windowGlow } from '../animation.ts';
import { CAMPUS_LAYOUT, FLOOR_HEIGHT, facadeBays, facadeCovered, type Side } from '../layout.ts';
import { WINDOW_CELL } from '../parts/materials.ts';
import { lightingAt } from '../lighting.ts';

const WARM = new Color('#ffd27a');
const _o = new Object3D();
const _c = new Color();
const SIDES: { side: Side; rot: number }[] = [{ side: 's', rot: 0 }, { side: 'n', rot: Math.PI }, { side: 'e', rot: Math.PI / 2 }, { side: 'w', rot: -Math.PI / 2 }];
const OUT = 0.03;
const WIN_H = FLOOR_HEIGHT * WINDOW_CELL.height;

interface Win { x: number; y: number; z: number; rot: number; width: number; block: BlockId; r: number }
type Energy = [BlockId, Forecast['perBlock'][BlockId]][];

/** Overnight floor of each block's energy (min over the day): the "base" a window's glow is measured against. */
function baseKwhByBlock(forecast: Forecast): Partial<Record<BlockId, number>> {
  const out: Partial<Record<BlockId, number>> = {};
  for (const [id, pb] of Object.entries(forecast.perBlock) as Energy) {
    out[id] = pb.energyKwh.length ? Math.min(...pb.energyKwh) : 0;
  }
  return out;
}

/** Warm emissive panes over the strip windows of the blocks (every storey above the recessed ground floor, except behind sun screens and cores), brighter with each block's energy use. One InstancedMesh. */
export function WindowGlow({ forecast, step }: { forecast: Forecast; step: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const wins = useMemo(() => {
    const rnd = seededRandom(41);
    const list: Win[] = [];
    for (const it of CAMPUS_LAYOUT) {
      if (!it.blockId || it.blockId === 'S' || !it.floors || !it.w || !it.d) continue;
      for (const { side, rot } of SIDES) {
        const onZ = side === 's' || side === 'n';
        const sign = side === 's' || side === 'e' ? 1 : -1;
        const length = onZ ? it.w : it.d;
        const bays = facadeBays(length), pitch = length / bays;
        const offset = sign * ((onZ ? it.d : it.w) / 2 + OUT);
        for (let f = 1; f < it.floors; f++) {
          for (let c = 0; c < bays; c++) {
            if (facadeCovered(it, side, (c + 0.5) / bays)) continue;
            const along = (c - (bays - 1) / 2) * pitch;
            list.push({
              x: it.x + (onZ ? along : offset), y: (f + WINDOW_CELL.centreY) * FLOOR_HEIGHT, z: it.z + (onZ ? offset : along),
              rot, width: pitch * WINDOW_CELL.width, block: it.blockId, r: rnd(),
            });
          }
        }
      }
    }
    return list;
  }, []);
  const base = useMemo(() => baseKwhByBlock(forecast), [forecast]);
  const night = lightingAt(step).night;

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const glow: Partial<Record<BlockId, number>> = {};
    for (const [id, pb] of Object.entries(forecast.perBlock) as Energy) {
      glow[id] = windowGlow(pb.energyKwh[step] ?? 0, base[id] ?? 0);
    }
    wins.forEach((w, i) => {
      const g = glow[w.block] ?? 0.1;
      const lit = (night || g > 0.3) && w.r < 0.35 + 0.65 * g;
      _o.position.set(w.x, w.y, w.z);
      _o.rotation.set(0, w.rot, 0);
      _o.scale.set(lit ? w.width : 0, lit ? WIN_H : 0, 1);
      _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix);
      m.setColorAt(i, _c.copy(WARM).multiplyScalar(0.35 + 0.65 * g));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [forecast, step, night, wins, base]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, wins.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
