import type { ThreeElements } from '@react-three/fiber';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const WHEELS: readonly (readonly [number, number])[] = [
  [-1.35, -0.82],
  [-1.35, 0.82],
  [1.35, -0.82],
  [1.35, 0.82],
];

interface CarProps {
  color: string;
  /** Roof colour; taxis wear a white roof over a red body. */
  roof?: string;
  taxi?: boolean;
}

/** A simple saloon car, about 4.3 m long, with its nose along local +X. */
export function Car({ color, roof, taxi = false, ...group }: CarProps & GroupProps) {
  return (
    <group {...group}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[4.3, 0.7, 1.75]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[-0.2, 1.18, 0]} castShadow>
        <boxGeometry args={[2.3, 0.5, 1.58]} />
        <meshStandardMaterial color="#1d2229" roughness={0.3} />
      </mesh>
      <mesh position={[-0.2, 1.46, 0]}>
        <boxGeometry args={[2.2, 0.08, 1.6]} />
        <meshStandardMaterial color={roof ?? color} roughness={0.45} metalness={0.2} />
      </mesh>
      {taxi && (
        <mesh position={[-0.2, 1.58, 0]}>
          <boxGeometry args={[0.3, 0.16, 0.7]} />
          <meshStandardMaterial color="#f4d03f" roughness={0.5} />
        </mesh>
      )}
      {WHEELS.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.32, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 12]} />
          <meshStandardMaterial color="#15171a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
