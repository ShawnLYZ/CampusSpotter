import { useMemo } from 'react';
import { BufferGeometry, Line, LineDashedMaterial, Vector3 } from 'three';
import { ROAD_SEGMENTS, routeCurve } from '../route.ts';
import { ROAD_TOTAL_SAMPLES, ribbonEdgePositions, ribbonGeometry } from '../roadGeometry.ts';
import type { PressureStyle } from '../pressureStyle.ts';
import { LANE, ROAD, zoneClick, type ZoneClick } from './shared.ts';

/** Shuttle road: one ribbon mesh (own material) per zone segment, plus one dashed centre line. */
export function Road({ onZoneClick, styles, selectedZone }: { onZoneClick?: ZoneClick; styles?: Record<string, PressureStyle>; selectedZone?: string | null }) {
  const segs = useMemo(() => ROAD_SEGMENTS.map((s) => ({ ...s, geo: ribbonGeometry(s.from, s.to), edges: ribbonEdgePositions(s.from, s.to) })), []);
  const dashes = useMemo(() => {
    const pts = routeCurve().getPoints(ROAD_TOTAL_SAMPLES).map((p) => new Vector3(p.x, p.y + 0.03, p.z));
    const line = new Line(new BufferGeometry().setFromPoints(pts), new LineDashedMaterial({ color: LANE, dashSize: 0.8, gapSize: 0.7 }));
    line.computeLineDistances();
    return line;
  }, []);
  return (
    <group>
      {segs.map((s) => {
        const st = styles?.[s.zoneId];
        const sel = selectedZone === s.zoneId;
        return (
        <mesh key={s.zoneId} geometry={s.geo} receiveShadow onClick={zoneClick(onZoneClick, s.zoneId)}>
          <meshStandardMaterial
            color={ROAD} roughness={0.95} toneMapped={!st?.glow}
            emissive={st?.color ?? '#000000'} emissiveIntensity={st?.glow ?? 0}
          />
          {sel && (
            <lineSegments raycast={() => null}>
              <bufferGeometry><bufferAttribute attach="attributes-position" args={[s.edges, 3]} /></bufferGeometry>
              <lineBasicMaterial color="#ffffff" toneMapped={false} />
            </lineSegments>
          )}
        </mesh>
        );
      })}
      <primitive object={dashes} />
    </group>
  );
}
