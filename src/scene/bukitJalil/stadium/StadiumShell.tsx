import { useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { STADIUM } from '../siteLayout.ts';
import { Instanced, Struts, type InstanceBuilder, type Segment } from '../helpers/Instanced.tsx';
import { ellipseCurve, ellipseNormal, ellipseOutline, flatShapeGeometry, yawTowards } from '../helpers/geometry.ts';

const { rx: RX, rz: RZ, wallTopY: WALL_TOP, rimY: RIM_Y } = STADIUM;

/** How far the structural wall sits inside the louvre line. */
const WALL_INSET = 7;
const CONCOURSE_LEVELS = [8.6, 18.4, 28.2];
const ROOF_PANELS = 36;

interface BandProps {
  inset: number;
  from: number;
  to: number;
  color: string;
}

/** A vertical elliptical band: the drum wall and its painted stripes. */
function Band({ inset, from, to, color }: BandProps) {
  return (
    <mesh position={[0, (from + to) / 2, 0]} scale={[RX - inset, 1, RZ - inset]} castShadow receiveShadow>
      <cylinderGeometry args={[1, 1, to - from, 128, 1, true]} />
      <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Open concourse decks between the wall and the louvres, glimpsed through the fins. */
function Concourses() {
  const deck = useMemo(() => flatShapeGeometry(ellipseOutline(RX - 1.4, RZ - 1.4, 128), [ellipseOutline(RX - WALL_INSET, RZ - WALL_INSET, 128)]), []);
  return (
    <>
      {CONCOURSE_LEVELS.map((y) => (
        <group key={y}>
          <mesh geometry={deck} position={[0, y, 0]} receiveShadow>
            <meshStandardMaterial color="#b5b7b8" roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
          <Band inset={1.4} from={y - 0.7} to={y} color="#c6c8c9" />
        </group>
      ))}
    </>
  );
}

/** Perimeter columns standing just inside the louvres. */
const COLUMNS: Segment[] = Array.from({ length: 72 }, (_, i): Segment => {
  const angle = (i / 72) * Math.PI * 2;
  const x = Math.cos(angle) * (RX - 2.4);
  const z = Math.sin(angle) * (RZ - 2.4);
  return [
    [x, 0, z],
    [x, WALL_TOP, z],
  ];
});

/** Raking struts carrying the roof's compression ring off the top of the wall. */
const ROOF_STRUTS: Segment[] = Array.from({ length: ROOF_PANELS }, (_, panel) => panel).flatMap((panel): Segment[] => {
  const angle = (panel / ROOF_PANELS) * Math.PI * 2;
  const spread = (Math.PI / ROOF_PANELS) * 0.55;
  const rim: THREE.Vector3Tuple = [Math.cos(angle) * (RX + 3), RIM_Y, Math.sin(angle) * (RZ + 3)];
  return [-spread, spread].map((offset): Segment => {
    const foot = angle + offset;
    return [[Math.cos(foot) * (RX - 5.5), WALL_TOP - 1.5, Math.sin(foot) * (RZ - 5.5)], rim];
  });
});

const FINS_PER_TIER = 500;
/** Three stacked bands of louvres, each stepping outwards so the drum flares towards the top. */
const FIN_TIERS = [
  { y: 13.9, height: 9.4, inset: 3.6 },
  { y: 23.6, height: 9.4, inset: 2.3 },
  { y: 33.3, height: 9.4, inset: 1.0 },
] as const;
const FIN_LEAN = THREE.MathUtils.degToRad(7);

/** Amber wash over the façade and roof while an event is on at the stadium. */
export const EVENT_GLOW = '#f59e0b';

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/**
 * The 2017 façade: vertical aluminium blades, each twisted about its own
 * axis. The twist varies smoothly round the drum, so bands of blades open
 * and close in waves.
 */
function Louvres({ glowing }: { glowing: boolean }) {
  const build = useCallback<InstanceBuilder>((i, object) => {
    const tierIndex = Math.floor(i / FINS_PER_TIER);
    const tier = FIN_TIERS[tierIndex];
    const angle = (((i % FINS_PER_TIER) + (tierIndex % 2) * 0.5) / FINS_PER_TIER) * Math.PI * 2;
    const rx = RX - tier.inset;
    const rz = RZ - tier.inset;
    const [nx, nz] = ellipseNormal(rx, rz, angle);
    const twist = 0.95 * Math.sin(angle * 8 + tierIndex * 2.2) + 0.25 * Math.sin(angle * 23 - tierIndex);

    object.position.set(Math.cos(angle) * rx, tier.y, Math.sin(angle) * rz);
    object.scale.set(1, tier.height, 1);
    // Face outwards, lean out with the drum, then twist about the blade's own axis.
    object.quaternion.setFromAxisAngle(AXIS_Y, yawTowards(nx, nz));
    object.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, -FIN_LEAN));
    object.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y, twist));
  }, []);

  return (
    <Instanced count={FINS_PER_TIER * FIN_TIERS.length} build={build} castShadow={false} receiveShadow={false}>
      <boxGeometry args={[0.95, 1, 0.1]} />
      <meshStandardMaterial color="#dfe2e4" roughness={0.5} emissive={EVENT_GLOW} emissiveIntensity={glowing ? 0.45 : 0} />
    </Instanced>
  );
}

const STAIR_RUN = 24;
const STAIR_RISE = CONCOURSE_LEVELS[0];
const STAIR_LENGTH = Math.hypot(STAIR_RUN, STAIR_RISE);
const STAIR_PITCH = Math.atan2(STAIR_RISE, STAIR_RUN);

/** A pair of external flights climbing to the first concourse — the white zig-zags on the façade. */
function Stairs({ angle }: { angle: number }) {
  const tangentX = -Math.sin(angle) * RX;
  const tangentZ = Math.cos(angle) * RZ;
  return (
    <group position={[Math.cos(angle) * (RX + 2.4), 0, Math.sin(angle) * (RZ + 2.4)]} rotation={[0, yawTowards(tangentX, tangentZ), 0]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (STAIR_RUN / 2 + 0.4), STAIR_RISE / 2, 0]} rotation={[0, 0, -side * STAIR_PITCH]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[STAIR_LENGTH, 0.5, 3.2]} />
            <meshStandardMaterial color="#e6e6e3" roughness={0.8} />
          </mesh>
          {[-1.6, 1.6].map((z) => (
            <mesh key={z} position={[0, 0.8, z]} castShadow>
              <boxGeometry args={[STAIR_LENGTH, 1.15, 0.18]} />
              <meshStandardMaterial color="#f1f1ee" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Landing bridging back to the concourse (local +Z points into the stadium). */}
      <mesh position={[0, STAIR_RISE - 0.25, 2.6]} castShadow receiveShadow>
        <boxGeometry args={[5, 0.5, 6.4]} />
        <meshStandardMaterial color="#e6e6e3" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Charcoal gate pavilion at ground level, with yellow doors. */
function Gate({ angle }: { angle: number }) {
  const tangentX = -Math.sin(angle) * RX;
  const tangentZ = Math.cos(angle) * RZ;
  return (
    <group position={[Math.cos(angle) * (RX + 1), 0, Math.sin(angle) * (RZ + 1)]} rotation={[0, yawTowards(tangentX, tangentZ), 0]}>
      <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[26, 6.4, 7]} />
        <meshStandardMaterial color="#5a5f66" roughness={0.8} />
      </mesh>
      <mesh position={[0, 6.7, -0.8]} castShadow>
        <boxGeometry args={[29, 0.5, 10]} />
        <meshStandardMaterial color="#6b7077" roughness={0.8} />
      </mesh>
      {[-8, 8].map((x) => (
        <mesh key={x} position={[x, 1.7, -3.55]}>
          <boxGeometry args={[4.5, 3.4, 0.15]} />
          <meshStandardMaterial color="#e2a626" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

const EIGHTH = Math.PI / 4;

/** Everything between the seats and the roof: drum wall, concourses, louvres, stairs, gates, rim. */
export function StadiumShell({ glowing }: { glowing: boolean }) {
  const apron = useMemo(
    () => flatShapeGeometry(ellipseOutline(RX + STADIUM.apron, RZ + STADIUM.apron, 128), [ellipseOutline(RX - WALL_INSET, RZ - WALL_INSET, 128)]),
    [],
  );
  const rim = useMemo(() => new THREE.TubeGeometry(ellipseCurve(RX + 3, RZ + 3, RIM_Y, 128), 256, 1.25, 8, true), []);
  return (
    <group>
      <mesh geometry={apron} position={[0, 0.05, 0]} receiveShadow>
        <meshStandardMaterial color="#a4a6a1" roughness={0.95} />
      </mesh>
      <Band inset={WALL_INSET} from={0} to={WALL_TOP} color="#8d9094" />
      <Band inset={WALL_INSET - 0.15} from={0} to={7.4} color="#6c7178" />
      <Band inset={WALL_INSET - 0.15} from={12.4} to={15.6} color="#d9a224" />
      <Concourses />
      <Struts segments={COLUMNS} radius={0.5} color="#b4b6b8" roughness={0.9} metalness={0} radialSegments={8} castShadow={false} />
      <Louvres glowing={glowing} />
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i}>
          <Gate angle={i * EIGHTH} />
          <Stairs angle={(i + 0.5) * EIGHTH} />
        </group>
      ))}
      <mesh geometry={rim} castShadow>
        <meshStandardMaterial color="#8f9498" roughness={0.6} metalness={0.2} />
      </mesh>
      <Struts segments={ROOF_STRUTS} radius={0.4} color="#9ea2a6" castShadow={false} />
    </group>
  );
}
