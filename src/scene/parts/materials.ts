import { CanvasTexture, RepeatWrapping, Shape, SRGBColorSpace, Vector2 } from 'three';

function canvas(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Where the strip window sits inside one bay of one storey, as fractions of the cell (y from the floor up). */
export const WINDOW_CELL = { width: 104 / 128, height: 56 / 128, centreY: 1 - 58 / 128 };

let windowCell: CanvasTexture | undefined;
let screenCell: CanvasTexture | undefined;

/** One bay of one storey (wall, a strip window, a mullion), repeated over a facade. */
export function facadeTexture(bays: number, floors: number): CanvasTexture {
  windowCell ??= canvas(128, (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#d9d9d4';
    g.fillRect(0, s - 6, s, 6);
    const grad = g.createLinearGradient(0, 30, 0, 86);
    grad.addColorStop(0, '#5d8792');
    grad.addColorStop(1, '#2f4750');
    g.fillStyle = grad;
    g.fillRect(12, 30, s - 24, 56);
    g.fillStyle = '#e8e8e4';
    g.fillRect(s / 2 - 2, 30, 4, 56);
  });
  const t = windowCell.clone();
  t.repeat.set(bays, floors);
  t.needsUpdate = true;
  return t;
}

/** The perforated metal sun screens on the block fronts. */
export function screenTexture(repeatX: number, repeatY: number): CanvasTexture {
  screenCell ??= canvas(64, (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#c4c7c9';
    for (let y = 0; y < s; y += 8) g.fillRect(0, y, s, 3);
    g.fillStyle = '#b3b6b8';
    g.fillRect(0, 0, 2, s);
  });
  const t = screenCell.clone();
  t.repeat.set(repeatX, repeatY);
  t.needsUpdate = true;
  return t;
}

/**
 * A rounded-box outline in plan (a superellipse), as points whose y is world -z,
 * so that after rotating the extrusion by -90° about X it lies flat with +z in front.
 */
export function roundedPlan(rx: number, rz: number, n = 2.8, cx = 0, cz = 0): Vector2[] {
  const pts: Vector2[] = [];
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push(new Vector2(
      cx + rx * Math.sign(c) * Math.abs(c) ** (2 / n),
      -(cz + rz * Math.sign(s) * Math.abs(s) ** (2 / n)),
    ));
  }
  return pts;
}

export function planShape(outer: Vector2[], hole?: Vector2[]): Shape {
  const shape = new Shape(outer);
  if (hole) shape.holes.push(new Shape(hole));
  return shape;
}
