import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, InstancedMesh, Object3D, Vector3 } from 'three';
import type { Forecast } from '@engine/output.ts';
import { fracAt } from '../../hooks/usePlayback.ts';
import { MAX_BUSES, busStatesInto } from '../animation.ts';
import { routeCurve } from '../route.ts';

const _o = new Object3D();
const _p = new Vector3();
const _t = new Vector3();
const T = new Float32Array(MAX_BUSES);
const DIR = new Uint8Array(MAX_BUSES);

/** Shuttle buses (white box + blue stripe), instanced at the 24-bus cap and positioned along the route spline each frame. */
export function Buses({ forecast, step }: { forecast: Forecast; step: number }) {
  const body = useRef<InstancedMesh>(null);
  const stripe = useRef<InstancedMesh>(null);
  const stripeGeo = useMemo(() => new BoxGeometry(2.44, 0.22, 1.04).translate(0, 0.12, 0), []);
  useEffect(() => () => stripeGeo.dispose(), [stripeGeo]);
  const last = useRef({ step: -1, frac: -1 });

  useLayoutEffect(() => { last.current.step = -1; }, [forecast, step]);

  useFrame(() => {
    const b = body.current, s = stripe.current;
    if (!b || !s) return;
    const frac = fracAt(step);
    if (last.current.step === step && last.current.frac === frac) return; // paused: nothing moves
    last.current.step = step; last.current.frac = frac;
    const n = busStatesInto(T, DIR, forecast, step, frac);
    const curve = routeCurve();
    for (let i = 0; i < n; i++) {
      curve.getPointAt(T[i]!, _p);
      curve.getTangentAt(T[i]!, _t);
      if (!DIR[i]) _t.negate();
      _o.position.set(_p.x, _p.y + 0.55, _p.z);
      _o.rotation.set(0, Math.atan2(-_t.z, _t.x), 0);
      _o.updateMatrix();
      b.setMatrixAt(i, _o.matrix);
      s.setMatrixAt(i, _o.matrix);
    }
    b.count = s.count = n;
    b.instanceMatrix.needsUpdate = s.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, MAX_BUSES]} frustumCulled={false} castShadow>
        <boxGeometry args={[2.4, 1, 1]} />
        <meshStandardMaterial color="#f2f2ee" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={stripe} args={[stripeGeo, undefined, MAX_BUSES]} frustumCulled={false}>
        <meshStandardMaterial color="#2563eb" roughness={0.6} />
      </instancedMesh>
    </>
  );
}
