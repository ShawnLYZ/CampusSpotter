import { GREY, WHITE, zoneClick, type ZoneClick } from './shared.ts';

const COLUMN_XS = [-9, -5.4, -1.8, 1.8, 5.4, 9];

/** Elevated LRT Bukit Jalil station on columns, a viaduct track along x, and the shuttle bay pad. */
export function LrtStation({ onZoneClick }: { onZoneClick?: ZoneClick }) {
  const click = zoneClick(onZoneClick, 'lrt-station');
  return (
    <group onClick={click}>
      <group position={[-100, 0, 0]}>
        <mesh position={[0, 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[24, 5, 3]} />
          <meshStandardMaterial color={WHITE} roughness={0.9} />
        </mesh>
        {COLUMN_XS.map((x) => (
          <mesh key={x} position={[x, 0.75, 0]} castShadow>
            <boxGeometry args={[0.6, 1.5, 0.6]} />
            <meshStandardMaterial color={GREY} />
          </mesh>
        ))}
        <mesh position={[0, 1.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[60, 0.3, 2]} />
          <meshStandardMaterial color={GREY} roughness={0.9} />
        </mesh>
      </group>
      <mesh position={[-92, 0.05, 6]} receiveShadow>
        <boxGeometry args={[6, 0.1, 4]} />
        <meshStandardMaterial color="#c3c6c1" roughness={1} />
      </mesh>
    </group>
  );
}
