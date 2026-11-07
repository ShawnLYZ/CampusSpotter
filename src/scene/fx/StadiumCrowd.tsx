import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { BufferGeometry, Group } from 'three';
import type { Forecast } from '@engine/output.ts';
import { seededRandom } from '../../lib/random.ts';
import { MAX_CROWD, stadiumCrowdCount } from '../animation.ts';

/** Crowd milling round TM Stadium Nasional on event days: points on a ring outside the bowl, slowly circulating. */
export function StadiumCrowd({ forecast, step }: { forecast: Forecast; step: number }) {
  const geo = useRef<BufferGeometry>(null);
  const group = useRef<Group>(null);
  const count = stadiumCrowdCount(forecast.metrics.lrtCrowding.detail.eventFlow?.[step] ?? 0);
  const positions = useMemo(() => {
    const rnd = seededRandom(23);
    const out = new Float32Array(MAX_CROWD * 3);
    for (let i = 0; i < MAX_CROWD; i++) {
      const a = rnd() * Math.PI * 2, r = 19.5 + rnd() * 7;
      out[i * 3] = Math.cos(a) * r; out[i * 3 + 1] = 0.35 + rnd() * 0.15; out[i * 3 + 2] = Math.sin(a) * r;
    }
    return out;
  }, []);

  useLayoutEffect(() => { geo.current?.setDrawRange(0, count); }, [count]);
  useFrame(({ clock }) => { if (group.current && count > 0) group.current.rotation.y = clock.elapsedTime * 0.04; });

  return (
    <group ref={group} position={[-105, 0, 40]} visible={count > 0}>
      <points frustumCulled={false}>
        <bufferGeometry ref={geo}><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
        <pointsMaterial color="#fbbf24" size={0.3} sizeAttenuation toneMapped={false} />
      </points>
    </group>
  );
}
