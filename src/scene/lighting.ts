import { stepStartMin } from '@engine/grid.ts';
import type { Vec3 } from './cameraPresets.ts';

export interface Lighting {
  sunIntensity: number;
  sunColor: string;
  ambient: number;
  skyColor: string;
  /** Unit vector pointing from the scene towards the sun (or moon at night). */
  sunDir: Vec3;
  night: boolean;
}

interface Keyframe { min: number; sun: number; sunColor: string; ambient: number; sky: string }

const KEYFRAMES: readonly Keyframe[] = [
  { min: 420, sun: 1.2, sunColor: '#fff4e0', ambient: 0.55, sky: '#1b2330' },
  { min: 720, sun: 1.6, sunColor: '#ffffff', ambient: 0.6, sky: '#1d2633' },
  { min: 1080, sun: 0.9, sunColor: '#ffb37a', ambient: 0.45, sky: '#1a1d2a' },
  { min: 1170, sun: 0.15, sunColor: '#7aa2ff', ambient: 0.3, sky: '#0d1220' },
  { min: 1560, sun: 0.1, sunColor: '#7aa2ff', ambient: 0.25, sky: '#0b0f14' },
];

const NIGHT_FROM_MIN = 1170;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, t));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Sun arcs east → west between 07:00 and 19:30; after dusk a low, fixed moon direction. */
function sunDirAt(min: number): Vec3 {
  const t = Math.min(1, Math.max(0, (min - 420) / (NIGHT_FROM_MIN - 420)));
  const theta = lerp(0.2, Math.PI - 0.2, t);
  const x = Math.cos(theta), y = Math.max(0.25, Math.sin(theta)), z = 0.45;
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}

/** Time-of-day lighting for a timeline step (07:00 + 15 min per step), interpolated between keyframes. */
export function lightingAt(step: number): Lighting {
  const min = stepStartMin(step);
  let i = 0;
  while (i < KEYFRAMES.length - 2 && min >= KEYFRAMES[i + 1]!.min) i++;
  const a = KEYFRAMES[i]!, b = KEYFRAMES[i + 1]!;
  const t = Math.min(1, Math.max(0, (min - a.min) / (b.min - a.min)));
  return {
    sunIntensity: lerp(a.sun, b.sun, t),
    sunColor: lerpHex(a.sunColor, b.sunColor, t),
    ambient: lerp(a.ambient, b.ambient, t),
    skyColor: lerpHex(a.sky, b.sky, t),
    sunDir: sunDirAt(min),
    night: min >= NIGHT_FROM_MIN,
  };
}
