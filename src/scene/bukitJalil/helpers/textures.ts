import * as THREE from 'three';

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/**
 * Every surface pattern in the model is painted onto a canvas at start-up,
 * so it needs no image downloads.
 */
export function canvasTexture(width: number, height: number, draw: Draw, anisotropy = 8): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is unavailable');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}
