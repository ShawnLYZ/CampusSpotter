import {
  BufferGeometry, CanvasTexture, CatmullRomCurve3, Float32BufferAttribute, RepeatWrapping, ShapeUtils, SRGBColorSpace,
  Vector2, Vector3,
} from 'three';
import type { Facade } from '../layout.ts';

export const WALL = '#f4f4f0';
export const ROOF_METAL = '#e4e6e7';
export const ROOF_CAP = '#cfcfca';
export const GLASS = '#5d8f95';
export const SCREEN = '#eef0f1';

type Draw = (g: CanvasRenderingContext2D, s: number) => void;

function canvas(size: number, draw: Draw): CanvasTexture {
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

function glass(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top = '#6a98a2', bottom = '#2c444d') {
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
}

export type Tile = Facade | 'base' | 'screen';

/** One repeating cell of each surface. Every cell is drawn white-based so the material colour tints it. */
const TILES: Record<Tile, Draw> = {
  // One bay of one storey: wall, a strip window in three panes, a shadow line at the floor slab.
  strip: (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#d4d4cf';
    g.fillRect(0, s - 5, s, 5);
    g.fillStyle = '#c2c5c3';
    g.fillRect(10, 86, s - 20, 3);
    glass(g, 12, 30, s - 24, 56);
    g.fillStyle = '#e9e9e5';
    for (const x of [46, 80]) g.fillRect(x - 1.5, 30, 3, 56);
  },
  // The recessed ground floor: glazing between piers under the first-floor slab.
  base: (g, s) => {
    glass(g, 0, 0, s, s, '#3d5a63', '#1b2a31');
    g.fillStyle = '#f2f2ee';
    g.fillRect(0, 0, s, 16);
    g.fillRect(0, 0, 11, s);
    g.fillRect(s - 11, 0, 11, s);
    g.fillStyle = '#51707a';
    g.fillRect(s / 2 - 1, 16, 2, s - 16);
    g.fillRect(11, 58, s - 22, 2);
  },
  // Stair cores and the residences: small windows punched in a white wall.
  punched: (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#dcdcd7';
    g.fillRect(0, s - 4, s, 4);
    for (const x of [20, 76]) {
      g.fillStyle = '#c9ccca';
      g.fillRect(x - 3, 33, 38, 54);
      glass(g, x, 36, 32, 48, '#5b7f8a', '#2a3f47');
    }
  },
  // Curtain wall: glass between mullions over a louvred spandrel.
  glass: (g, s) => {
    glass(g, 0, 0, s, s, '#86bdb9', '#3f7378');
    g.fillStyle = '#a9b4b3';
    g.fillRect(0, s - 30, s, 30);
    g.fillStyle = '#8c9897';
    for (let y = s - 27; y < s; y += 6) g.fillRect(0, y, s, 2);
    g.fillStyle = '#e4ecea';
    for (let x = 0; x < s; x += 32) g.fillRect(x, 0, 3, s);
    g.fillRect(0, 0, s, 3);
  },
  // Car park decks behind vertical fins, with planting showing between them.
  fins: (g, s) => {
    const grad = g.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, '#2c3236');
    grad.addColorStop(0.55, '#3a4a3c');
    grad.addColorStop(1, '#55724a');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#f0f0ec';
    for (let x = 6; x < s; x += 32) g.fillRect(x, 0, 12, s);
    g.fillRect(0, 0, s, 22);
    g.fillStyle = '#d6d6d1';
    g.fillRect(0, 22, s, 3);
  },
  // A blank wall: panel joints and one slot window.
  plain: (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#dadad5';
    g.fillRect(0, s - 4, s, 4);
    g.fillRect(0, 0, 2, s);
    glass(g, 22, 44, 84, 14, '#55747d', '#33474f');
  },
  // Perforated metal sun screen: rows of fine holes between panel joints.
  screen: (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#b9bec2';
    for (let y = 5; y < s; y += 7) for (let x = 5 + ((y / 7) % 2) * 3.5; x < s; x += 7) g.fillRect(x, y, 3, 3);
    g.fillStyle = '#a2a8ad';
    g.fillRect(0, 0, s, 2);
    g.fillRect(0, 0, 2, s);
  },
};

const cells = new Map<Tile, CanvasTexture>();

/** A surface texture tiled `repeatX` by `repeatY` times across a face. */
export function tileTexture(kind: Tile, repeatX: number, repeatY: number): CanvasTexture {
  let cell = cells.get(kind);
  if (!cell) {
    cell = canvas(128, TILES[kind]);
    cells.set(kind, cell);
  }
  const t = cell.clone();
  t.repeat.set(repeatX, repeatY);
  t.needsUpdate = true;
  return t;
}

/** A closed outline in plan as (x, z) points. Rings are kept wound so that `loftGeometry` faces outwards. */
export type Ring = Vector2[];

function oriented(pts: Ring): Ring {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area < 0 ? [...pts].reverse() : pts;
}

export function rectRing(w: number, d: number, cx = 0, cz = 0): Ring {
  const hx = w / 2, hz = d / 2;
  return [new Vector2(cx + hx, cz - hz), new Vector2(cx + hx, cz + hz), new Vector2(cx - hx, cz + hz), new Vector2(cx - hx, cz - hz)];
}

/** A rounded box (superellipse) of half-sizes `rx`, `rz`, turned by `turn` radians about its centre. */
export function roundedRing(rx: number, rz: number, n = 2.8, cx = 0, cz = 0, turn = 0, segments = 72): Ring {
  const cos = Math.cos(turn), sin = Math.sin(turn);
  const pts: Ring = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const x = rx * Math.sign(c) * Math.abs(c) ** (2 / n), z = rz * Math.sign(s) * Math.abs(s) ** (2 / n);
    pts.push(new Vector2(cx + x * cos + z * sin, cz - x * sin + z * cos));
  }
  return oriented(pts);
}

/** A smooth closed curve through `points`, sampled evenly along its length. */
export function smoothRing(points: [number, number][], segments = 128): Ring {
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)), true, 'centripetal');
  return oriented(curve.getSpacedPoints(segments).slice(0, segments).map((p) => new Vector2(p.x, p.z)));
}

/** The ring moved inwards by `by` (outwards when negative), point for point. */
export function insetRing(ring: Ring, by: number): Ring {
  const n = ring.length;
  return ring.map((p, i) => {
    const a = ring[(i + n - 1) % n]!, b = ring[(i + 1) % n]!;
    const tx = b.x - a.x, tz = b.y - a.y;
    const len = Math.hypot(tx, tz) || 1;
    return new Vector2(p.x - (tz / len) * by, p.y + (tx / len) * by);
  });
}

/**
 * A solid lofted through horizontal rings (bottom first), each at its own height; all rings have the same number of
 * points. `smooth` shades round the ring (creases between bands stay sharp); `caps: false` leaves both ends open.
 */
export function loftGeometry(rings: { pts: Ring; y: number }[], { smooth = false, caps = true } = {}): BufferGeometry {
  const n = rings[0]!.pts.length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let b = 0; b < rings.length - 1; b++) {
    const base = pos.length / 3;
    for (const r of [rings[b]!, rings[b + 1]!]) for (const p of r.pts) pos.push(p.x, r.y, p.y);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      idx.push(base + i, base + n + i, base + j, base + j, base + n + i, base + n + j);
    }
  }
  if (caps) {
    for (const [ring, up] of [[rings[0]!, false], [rings[rings.length - 1]!, true]] as const) {
      const base = pos.length / 3;
      for (const p of ring.pts) pos.push(p.x, ring.y, p.y);
      for (const [a, b, c] of ShapeUtils.triangulateShape(ring.pts, []) as [number, number, number][]) {
        if (up) idx.push(base + a, base + c, base + b); else idx.push(base + a, base + b, base + c);
      }
    }
  }
  const indexed = new BufferGeometry();
  indexed.setAttribute('position', new Float32BufferAttribute(pos, 3));
  indexed.setIndex(idx);
  const geo = smooth ? indexed : indexed.toNonIndexed();
  geo.computeVertexNormals();
  return geo;
}

/** A thin oversailing roof plate `w` by `d`: a square-edged eave under a very shallow hip. Sits on y = 0. */
export function roofGeometry(w: number, d: number): BufferGeometry {
  const run = Math.min(w, d) * 0.42;
  return loftGeometry([
    { pts: rectRing(w, d), y: 0 },
    { pts: rectRing(w, d), y: 0.45 },
    { pts: rectRing(w - 2 * run, d - 2 * run), y: 0.45 + run * 0.1 },
  ]);
}

/** A ramp `w` by `d` rising from the ground at its south edge to `h` at its north edge. */
export function wedgeGeometry(w: number, d: number, h: number): BufferGeometry {
  const x = w / 2, z = d / 2;
  const v = [[-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z], [x, h, -z], [-x, h, -z]] as const;
  const tris = [[0, 1, 4], [0, 4, 5], [1, 2, 4], [0, 5, 3], [3, 5, 4], [3, 4, 2], [0, 3, 2], [0, 2, 1]];
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(tris.flat().flatMap((i) => [...v[i]!]), 3));
  geo.computeVertexNormals();
  return geo;
}
