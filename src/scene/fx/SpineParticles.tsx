import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { BufferAttribute, BufferGeometry } from 'three';
import type { Forecast } from '@engine/output.ts';
import { seededRandom } from '../../lib/random.ts';
import { MAX_SPINE_PARTICLES, spineParticleCount } from '../animation.ts';
import { SPINE_DECK } from '../layout.ts';

const { x0: X0, x1: X1, z: Z } = SPINE_DECK;
const LEN = X1 - X0, Y = SPINE_DECK.y + 0.2, SPEED = 2.5;

/** Walkers on the Spine deck: points drifting along x at constant speed, two directions, count from walkway flow. */
export function SpineParticles({ forecast, step }: { forecast: Forecast; step: number }) {
  const geo = useRef<BufferGeometry>(null);
  const count = spineParticleCount(forecast.metrics.walkwayTraffic.detail.flowPerMin?.[step] ?? 0);
  const seeds = useMemo(() => {
    const rnd = seededRandom(11);
    return Array.from({ length: MAX_SPINE_PARTICLES }, (_, i) => ({ phase: rnd() * LEN, z: Z + (rnd() - 0.5) * 3, dir: i % 2 ? 1 : -1 }));
  }, []);
  const positions = useMemo(() => new Float32Array(MAX_SPINE_PARTICLES * 3), []);

  useLayoutEffect(() => { geo.current?.setDrawRange(0, count); }, [count]);

  useFrame(({ clock }) => {
    const g = geo.current;
    if (!g || count === 0) return;
    const t = clock.elapsedTime * SPEED;
    for (let i = 0; i < count; i++) {
      const s = seeds[i]!;
      const u = (((s.phase + s.dir * t) % LEN) + LEN) % LEN;
      positions[i * 3] = X0 + u; positions[i * 3 + 1] = Y; positions[i * 3 + 2] = s.z;
    }
    (g.attributes.position as BufferAttribute).needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geo}><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color="#ffd9a0" size={0.22} sizeAttenuation toneMapped={false} />
    </points>
  );
}
