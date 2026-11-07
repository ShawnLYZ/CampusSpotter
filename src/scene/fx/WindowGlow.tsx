import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import type { Forecast } from '@engine/output.ts';
import type { BlockId } from '@engine/types.ts';
import { seededRandom } from '../../lib/random.ts';
import { windowGlow } from '../animation.ts';
import { CAMPUS_LAYOUT, FLOOR_HEIGHT } from '../layout.ts';
import { lightingAt } from '../lighting.ts';

const WARM = new Color('#ffd27a');
const _o = new Object3D();
const _c = new Color();
const WIN_W = 1.0, WIN_H = 0.38, COL_PITCH = 2;

interface Win { x: number; y: number; z: number; flip: boolean; block: BlockId; r: number }
type Energy = [BlockId, Forecast['perBlock'][BlockId]][];

/** Overnight floor of each block's energy (min over the day): the "base" a window's glow is measured against. */
function baseKwhByBlock(forecast: Forecast): Partial<Record<BlockId, number>> {
  const out: Partial<Record<BlockId, number>> = {};
  for (const [id, pb] of Object.entries(forecast.perBlock) as Energy) {
    out[id] = pb.energyKwh.length ? Math.min(...pb.energyKwh) : 0;
  }
  return out;
}

/** Warm emissive window panes on the front and back facades of the blocks, brighter with each block's energy use. One InstancedMesh. */
export function WindowGlow({ forecast, step }: { forecast: Forecast; step: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const wins = useMemo(() => {
    const rnd = seededRandom(41);
    const out: Win[] = [];
    for (const it of CAMPUS_LAYOUT) {
      if (!it.blockId || it.blockId === 'S' || !it.floors || !it.w || !it.d) continue;
      const cols = Math.max(1, Math.floor((it.w - 1) / COL_PITCH));
      for (const side of [1, -1]) {
        for (let f = 0; f < it.floors; f++) {
          for (let c = 0; c < cols; c++) {
            out.push({
              x: it.x + (c - (cols - 1) / 2) * COL_PITCH, y: (f + 0.5) * FLOOR_HEIGHT,
              z: it.z + side * (it.d / 2 + 0.05), flip: side < 0, block: it.blockId, r: rnd(),
            });
          }
        }
      }
    }
    return out;
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
      _o.rotation.set(0, w.flip ? Math.PI : 0, 0);
      _o.scale.setScalar(lit ? 1 : 0);
      _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix);
      m.setColorAt(i, _c.copy(WARM).multiplyScalar(0.35 + 0.65 * g));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [forecast, step, night, wins, base]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, wins.length]} frustumCulled={false}>
      <planeGeometry args={[WIN_W, WIN_H]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
