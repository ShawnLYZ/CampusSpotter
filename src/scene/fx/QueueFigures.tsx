import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';
import type { Forecast } from '@engine/output.ts';
import { seededRandom } from '../../lib/random.ts';
import { MAX_QUEUE_FIGURES, queueFigures } from '../animation.ts';
import { ChipSprite } from '../parts/ZoneLabel.tsx';
import type { PressureStyle } from '../pressureStyle.ts';

const SPACING = 0.6, FIGURE_Y = 0.32;
/** Grid origins (x, z); rows of `perRow` extend away from the stop. The APU queue fills the forecourt east of the grand stair. */
const APU_ORIGIN = { x: 17.2, z: 13.4, dz: -1, perRow: 20 };
const LRT_ORIGIN = { x: -95, z: 8.6, dz: 1, perRow: 10 };
const LABEL_STYLE: PressureStyle = { color: '#f59e0b', glow: 0, tintOpacity: 0, text: '', icon: '●' };
const _o = new Object3D();

/** Capsule figures queuing at the APU stop and the LRT bay: at most 200 each, one instanced mesh, "×N" chip when scaled. */
export function QueueFigures({ forecast, step }: { forecast: Forecast; step: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const apu = queueFigures(forecast.metrics.apuStopQueue.detail.queue?.[step] ?? 0);
  const lrt = queueFigures(forecast.metrics.lrtStopQueue.detail.queue?.[step] ?? 0);
  // Fixed seeded jitter per slot, so figures do not shimmer between steps.
  const jitter = useMemo(() => {
    const rnd = seededRandom(5);
    return Array.from({ length: MAX_QUEUE_FIGURES * 2 }, () => [(rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.25] as const);
  }, []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    let n = 0;
    const place = (count: number, o: typeof APU_ORIGIN, base: number) => {
      for (let i = 0; i < count; i++) {
        const j = jitter[base + i]!;
        _o.position.set(o.x + (i % o.perRow) * SPACING + j[0], FIGURE_Y, o.z + o.dz * Math.floor(i / o.perRow) * SPACING + j[1]);
        _o.updateMatrix();
        m.setMatrixAt(n++, _o.matrix);
      }
    };
    place(apu.count, APU_ORIGIN, 0);
    place(lrt.count, LRT_ORIGIN, MAX_QUEUE_FIGURES);
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  }, [apu.count, lrt.count, jitter]);

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, MAX_QUEUE_FIGURES * 2]} frustumCulled={false}>
        <capsuleGeometry args={[0.13, 0.3, 3, 8]} />
        <meshStandardMaterial color="#cfd6dd" roughness={0.8} />
      </instancedMesh>
      {apu.overflowLabel && <ChipSprite position={[APU_ORIGIN.x + 2.7, 1.8, APU_ORIGIN.z - 1]} style={LABEL_STYLE} text={`${apu.overflowLabel} per figure`} />}
      {lrt.overflowLabel && <ChipSprite position={[LRT_ORIGIN.x + 2.7, 1.8, LRT_ORIGIN.z + 1]} style={LABEL_STYLE} text={`${lrt.overflowLabel} per figure`} />}
    </>
  );
}
