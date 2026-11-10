import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATION } from '../siteLayout.ts';
import { arcLengthNearest, stationToWorld, trackCurve } from '../track.ts';
import { yawTowards } from '../helpers/geometry.ts';

const CARS = 6;
const CAR_LENGTH = 14.1;

const TRACK_LENGTH = trackCurve.getLength();
/** Arc length along the viaduct at which a train is centred on the platforms. */
const STATION_AT = arcLengthNearest(trackCurve, stationToWorld(0, 0, 0));

/*
 * Motion profile for one leg (approach or departure): cruise at line speed,
 * then brake at a constant rate over the last BRAKE_DISTANCE metres.
 */
const CRUISE_SPEED = 22;
const BRAKE_DISTANCE = 250;
const RUN = 800;
const BRAKE_TIME = (2 * BRAKE_DISTANCE) / CRUISE_SPEED;
const CRUISE_TIME = (RUN - BRAKE_DISTANCE) / CRUISE_SPEED;
const LEG_TIME = CRUISE_TIME + BRAKE_TIME;
const DWELL_TIME = 10;
const CYCLE_TIME = 2 * LEG_TIME + DWELL_TIME + 5;

/** Metres still to run to the stopping point, `t` seconds into an approach. */
function distanceToStop(t: number): number {
  if (t < CRUISE_TIME) return RUN - CRUISE_SPEED * t;
  const remaining = LEG_TIME - t;
  return (CRUISE_SPEED * remaining * remaining) / (2 * BRAKE_TIME);
}

/**
 * Signed distance of the train from its stopping point: negative while
 * arriving, zero while dwelling, positive once departing. A departure is an
 * approach played backwards. Returns null between services.
 */
function distanceFromStop(time: number): number | null {
  const t = ((time % CYCLE_TIME) + CYCLE_TIME) % CYCLE_TIME;
  if (t < LEG_TIME) return -distanceToStop(t);
  if (t < LEG_TIME + DWELL_TIME) return 0;
  if (t < 2 * LEG_TIME + DWELL_TIME) return distanceToStop(2 * LEG_TIME + DWELL_TIME - t);
  return null;
}

const BODY = '#f4f5f6';
const GLASS = '#1b2029';

function TrainCar({ cab }: { cab: -1 | 0 | 1 }) {
  return (
    <>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[CAR_LENGTH - 1.2, 0.6, 2.3]} />
        <meshStandardMaterial color="#2a2d31" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.15, 0]} castShadow>
        <boxGeometry args={[CAR_LENGTH - 0.5, 2.7, 2.65]} />
        <meshStandardMaterial color={BODY} roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[0, 2.55, 0]}>
        <boxGeometry args={[CAR_LENGTH - 0.48, 0.85, 2.68]} />
        <meshStandardMaterial color={GLASS} roughness={0.25} />
      </mesh>
      <mesh position={[0, 1.56, 0]}>
        <boxGeometry args={[CAR_LENGTH - 0.47, 0.18, 2.69]} />
        <meshStandardMaterial color="#c8102e" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.34, 0]}>
        <boxGeometry args={[CAR_LENGTH - 0.47, 0.12, 2.69]} />
        <meshStandardMaterial color="#1d4fa3" roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.62, 0]}>
        <boxGeometry args={[CAR_LENGTH - 4, 0.3, 1.7]} />
        <meshStandardMaterial color="#c9ccd0" roughness={0.7} />
      </mesh>
      {cab !== 0 && (
        <mesh position={[cab * (CAR_LENGTH / 2 - 0.22), 2.35, 0]}>
          <boxGeometry args={[0.1, 1.5, 2.3]} />
          <meshStandardMaterial color="#11151b" roughness={0.25} />
        </mesh>
      )}
    </>
  );
}

interface TrainProps {
  /** +1 runs south-east (towards Sungai Besi), -1 runs north-west (towards Sri Petaling). */
  direction: 1 | -1;
  /** Seconds this train's timetable is offset by. */
  phase: number;
}

function Train({ direction, phase }: TrainProps) {
  const train = useRef<THREE.Group>(null);
  const cars = useRef<(THREE.Group | null)[]>([]);
  const clock = useRef(phase);

  useFrame((_, delta) => {
    const group = train.current;
    if (!group) return;
    // Clamp the step so a backgrounded tab doesn't teleport the train on return.
    clock.current += Math.min(delta, 0.1);
    const fromStop = distanceFromStop(clock.current);
    group.visible = fromStop !== null;
    if (fromStop === null) return;

    const point = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    for (let k = 0; k < CARS; k++) {
      const car = cars.current[k];
      if (!car) continue;
      const along = STATION_AT + direction * fromStop + (k - (CARS - 1) / 2) * CAR_LENGTH;
      // The viaduct ends at the edges of the scene: a car beyond either end is out of sight.
      car.visible = along >= 0 && along <= TRACK_LENGTH;
      if (!car.visible) continue;
      const u = along / TRACK_LENGTH;
      trackCurve.getPointAt(u, point);
      trackCurve.getTangentAt(u, tangent);
      // Trains keep left, as on Malaysian roads.
      const lateral = direction * STATION.trackOffset;
      car.position.set(point.x + tangent.z * lateral, STATION.railY, point.z - tangent.x * lateral);
      car.rotation.y = yawTowards(tangent.x, tangent.z);
    }
  });

  return (
    <group ref={train} visible={false}>
      {Array.from({ length: CARS }, (_, k) => (
        <group
          key={k}
          ref={(node) => {
            cars.current[k] = node;
          }}
        >
          <TrainCar cab={k === 0 ? -1 : k === CARS - 1 ? 1 : 0} />
        </group>
      ))}
    </group>
  );
}

/** Two six-car trains shuttling through the station, one in each direction. */
export function Trains() {
  return (
    <>
      <Train direction={1} phase={LEG_TIME - 6} />
      <Train direction={-1} phase={LEG_TIME - 6 + CYCLE_TIME / 2} />
    </>
  );
}
