import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { hourIndexAtStep } from '@engine/grid.ts';
import type { BufferAttribute, BufferGeometry } from 'three';
import { seededRandom } from '../../lib/random.ts';
import { MAX_RAIN_DROPS, rainDrops } from '../animation.ts';

const X0 = -140, W = 200, Z0 = -40, D = 120, H = 40, SPEED = 32, LEN = 1.4, SLANT = 0.25;

/** Falling rain streaks in a 200 x 120 box over the campus and road: one LineSegments at the 1500 cap. */
export function Rain({ weatherMm, step }: { weatherMm?: (number | null)[]; step: number }) {
  const geo = useRef<BufferGeometry>(null);
  const count = rainDrops(weatherMm?.[hourIndexAtStep(step)] ?? null);
  const seeds = useMemo(() => {
    const rnd = seededRandom(31);
    return Array.from({ length: MAX_RAIN_DROPS }, () => ({ x: X0 + rnd() * W, z: Z0 + rnd() * D, y: rnd() * H, v: 0.8 + rnd() * 0.4 }));
  }, []);
  const positions = useMemo(() => new Float32Array(MAX_RAIN_DROPS * 6), []);

  useLayoutEffect(() => { geo.current?.setDrawRange(0, count * 2); }, [count]);

  useFrame(({ clock }) => {
    const g = geo.current;
    if (!g || count === 0) return;
    const t = clock.elapsedTime * SPEED;
    for (let i = 0; i < count; i++) {
      const s = seeds[i]!;
      const y = (((s.y - t * s.v) % H) + H) % H;
      const o = i * 6;
      positions[o] = s.x; positions[o + 1] = y + LEN; positions[o + 2] = s.z;
      positions[o + 3] = s.x - SLANT; positions[o + 4] = y; positions[o + 5] = s.z;
    }
    (g.attributes.position as BufferAttribute).needsUpdate = true;
  });

  return (
    <lineSegments frustumCulled={false} visible={count > 0}>
      <bufferGeometry ref={geo}><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#9fb8d6" transparent opacity={0.55} toneMapped={false} />
    </lineSegments>
  );
}
