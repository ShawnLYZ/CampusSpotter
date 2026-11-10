import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import { canvasTexture } from './textures.ts';

interface SignProps {
  /** Board size in metres. */
  width: number;
  height: number;
  text: string;
  /** A solid fill, or a left-to-right gradient. */
  background: string | readonly [string, string];
  color?: string;
  subtitle?: string;
  /** Main text height as a fraction of the board height. */
  textScale?: number;
  /** Thickness of the board behind the face. */
  depth?: number;
  /** Self-illumination. A little keeps lettering legible in shade; screens want much more. */
  glow?: number;
}

const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

/**
 * A lettered signboard. The face is painted on a canvas with system fonts,
 * so signage works offline and needs no font files.
 */
export function Sign({
  width,
  height,
  text,
  background,
  color = '#ffffff',
  subtitle,
  textScale = 0.5,
  depth = 0.25,
  glow = 0.12,
  ...group
}: SignProps & Omit<ThreeElements['group'], 'children'>) {
  const texture = useMemo(() => {
    const pixelsPerMetre = Math.min(48, 1024 / width);
    return canvasTexture(Math.round(width * pixelsPerMetre), Math.round(height * pixelsPerMetre), (ctx, w, h) => {
      if (typeof background === 'string') {
        ctx.fillStyle = background;
      } else {
        const gradient = ctx.createLinearGradient(0, 0, w, 0);
        gradient.addColorStop(0, background[0]);
        gradient.addColorStop(1, background[1]);
        ctx.fillStyle = gradient;
      }
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = h * textScale;
      ctx.font = `700 ${size}px ${FONT}`;
      const measured = ctx.measureText(text).width;
      if (measured > w * 0.9) {
        size *= (w * 0.9) / measured;
        ctx.font = `700 ${size}px ${FONT}`;
      }
      ctx.fillText(text, w / 2, subtitle ? h * 0.42 : h * 0.52);
      if (subtitle) {
        ctx.font = `500 ${h * 0.14}px ${FONT}`;
        ctx.fillText(subtitle, w / 2, h * 0.8);
      }
    });
  }, [width, height, text, background, color, subtitle, textScale]);

  return (
    <group {...group}>
      <mesh castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#3a3d42" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, depth / 2 + 0.02]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture} roughness={0.7} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={glow} />
      </mesh>
    </group>
  );
}
