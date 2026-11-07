import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type Ref } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace, Vector3, type Sprite } from 'three';
import type { PressureStyle } from '../pressureStyle.ts';
import { LABEL_GAP, QUIET_LABEL_FAR, labelOrder, placeLabels } from '../labelDeclutter.ts';
import type { Zone } from '../zones.ts';

const W = 512, H = 64;  // fixed texture size per label; the chip is drawn left-aligned and cropped with texture.repeat
const FONT = '600 28px Inter, system-ui, sans-serif';
const SCREEN_H = 0.034; // sprite height as a fraction of the view height (constant on screen)

/** Chip text, e.g. 'Busy · 34 min'; empty when the zone has no label. */
function labelText(style: PressureStyle, valueText: string): string {
  return style.text ? `${style.text}${valueText ? ` · ${valueText}` : ''}` : '';
}

/** Draws the chip (dark pill, coloured border, coloured icon) into `canvas`; returns the chip width in px. */
function drawChip(canvas: HTMLCanvasElement, style: PressureStyle, text: string): number {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  ctx.font = FONT; ctx.textBaseline = 'middle';
  const iconW = ctx.measureText(style.icon).width, gap = 10, pad = 18;
  const w = Math.min(W, Math.ceil(pad * 2 + iconW + gap + ctx.measureText(text).width));
  ctx.fillStyle = 'rgba(11,15,20,0.92)';
  ctx.strokeStyle = style.color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, H - 4, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = style.color; ctx.fillText(style.icon, pad, H / 2 + 1);
  ctx.fillStyle = '#e6edf5'; ctx.fillText(text, pad + iconW + gap, H / 2 + 1);
  return w;
}

/**
 * Floating icon-and-word chip above a zone, a screen-constant sprite (no DOM). One canvas and texture per label,
 * redrawn only when the text or colour changes (and once the web fonts are ready). Hidden when there is no text.
 */
export function ZoneLabel({ zone, style, valueText, ref }: { zone: Zone; style: PressureStyle; valueText: string; ref?: Ref<Sprite> }) {
  const [x, y, z] = zone.anchor;
  return <ChipSprite position={[x, y + 3, z]} style={style} text={labelText(style, valueText)} ref={ref} />;
}

/** Screen-constant chip sprite at a world position (shared by zone labels and the queue "×N" labels). Hidden when `text` is empty. */
export function ChipSprite({ position, style, text, ref }: { position: [number, number, number]; style: PressureStyle; text: string; ref?: Ref<Sprite> }) {
  const { canvas, tex } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return { canvas: c, tex: t };
  }, []);
  const sprite = useRef<Sprite | null>(null);
  const invalidate = useThree((st) => st.invalidate);
  const latest = useRef({ style, text });
  latest.current = { style, text };

  const redraw = () => {
    const { style: s, text: t } = latest.current;
    if (!t) return;
    const w = drawChip(canvas, s, t);
    tex.repeat.set(w / W, 1);
    tex.needsUpdate = true;
    sprite.current?.scale.set(SCREEN_H * (w / H), SCREEN_H, 1);
    invalidate(); // demand frameloop: e.g. the redraw once web fonts load
  };
  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;

  useLayoutEffect(() => { redrawRef.current(); }, [style.color, style.icon, text]);
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => { if (live) redrawRef.current(); });
    return () => { live = false; };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);

  // Stable callback ref (re-created only if the parent's ref changes); no redraw here, the layout effect covers text and colour.
  const setSprite = useCallback((s: Sprite | null) => {
    sprite.current = s;
    if (typeof ref === 'function') ref(s); else if (ref) ref.current = s;
  }, [ref]);

  if (!text) return null;
  return (
    <sprite
      ref={setSprite}
      position={position} scale={[SCREEN_H * 6, SCREEN_H, 1]} renderOrder={999} raycast={() => null}>
      <spriteMaterial map={tex} sizeAttenuation={false} depthTest={false} transparent toneMapped={false} />
    </sprite>
  );
}

interface LabelState { zone: Zone; style: PressureStyle; valueText: string; severity: number }

const _v = new Vector3();

/** All zone labels, decluttered each frame: quiet labels drop when far, clipped chips hide, overlaps resolve by severity. */
export function ZoneLabels({ states, selectedZone }: { states: LabelState[]; selectedZone: string | null }) {
  const n = states.length;
  const sprites = useRef<(Sprite | null)[]>([]);
  const bufs = useMemo(() => ({
    ok: new Uint8Array(n), visible: new Uint8Array(n),
    cx: new Float32Array(n), cy: new Float32Array(n), hw: new Float32Array(n), hh: new Float32Array(n),
  }), [n]);
  const order = useMemo(
    () => labelOrder(states.map((s) => s.severity), states.findIndex((s) => s.zone.id === selectedZone)),
    [states, selectedZone],
  );
  const setters = useMemo(() => Array.from({ length: n }, (_, i) => (sp: Sprite | null) => { sprites.current[i] = sp; }), [n]);
  const quiet = useMemo(() => states.map((s) => s.severity <= 1 && s.zone.id !== selectedZone), [states, selectedZone]);

  useFrame(({ camera, size }) => {
    const { ok, visible, cx, cy, hw, hh } = bufs;
    const hPx = (SCREEN_H * camera.projectionMatrix.elements[5] * size.height) / 2;
    for (let i = 0; i < n; i++) {
      const s = sprites.current[i];
      ok[i] = 0;
      if (!s) continue;
      _v.setFromMatrixPosition(s.matrixWorld);
      const dist = _v.distanceTo(camera.position);
      _v.project(camera);
      const w = (s.scale.x / s.scale.y) * hPx;
      cx[i] = (_v.x * 0.5 + 0.5) * size.width; cy[i] = (0.5 - _v.y * 0.5) * size.height;
      hw[i] = w / 2; hh[i] = hPx / 2;
      const inView = _v.z < 1 && cx[i] - hw[i] >= 0 && cx[i] + hw[i] <= size.width && cy[i] - hh[i] >= 0 && cy[i] + hh[i] <= size.height;
      ok[i] = inView && !(quiet[i] && dist > QUIET_LABEL_FAR) ? 1 : 0;
    }
    placeLabels(order, ok, cx, cy, hw, hh, visible, LABEL_GAP);
    for (let i = 0; i < n; i++) { const s = sprites.current[i]; if (s) s.visible = visible[i] === 1; }
  });

  return (
    <>
      {states.map((s, i) => (
        <ZoneLabel key={s.zone.id} zone={s.zone} style={s.style} valueText={s.valueText} ref={setters[i]} />
      ))}
    </>
  );
}
