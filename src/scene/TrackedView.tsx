import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal, useFrame, useThree, type RootState } from '@react-three/fiber';
import { Scene } from 'three';

/**
 * One view of the shared canvas, drawn into the screen rect of `track` with a scissor (a local stand-in for drei's
 * canvas-side `View`). drei 10.7 tests "offscreen" by comparing the track's viewport rect with the canvas *size*
 * (`track.left > canvas.width`), so a view whose canvas doesn't start at the viewport origin (the right half of
 * Scenario Lab's split, or any scene lower than its own height on the page) is never drawn. Here every test and
 * offset is relative to the canvas's live bounding rect.
 */
export function TrackedView({ track, index, children }: { track: RefObject<HTMLElement>; index: number; children: ReactNode }) {
  const size = useThree((s) => s.size); // re-render (and re-measure the portal) when the canvas resizes
  const [scene] = useState(() => new Scene());
  const rect = useRef<DOMRect | null>(null);
  const [ready, setReady] = useState(false);

  const compute = useCallback((event: PointerEvent, state: RootState) => {
    const r = rect.current;
    if (!r || !track.current || event.target !== track.current) return;
    state.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
    state.raycaster.setFromCamera(state.pointer, state.camera);
  }, [track]);

  useEffect(() => {
    rect.current = track.current?.getBoundingClientRect() ?? null;
    setReady(true);
  }, [track]);

  if (!ready) return null;
  // Measured during render (re-run on every canvas resize via `size`), so the portal size never lags the layout.
  const r = track.current?.getBoundingClientRect() ?? rect.current;
  if (r) rect.current = r;
  return createPortal(
    <Container track={track} rect={rect} index={index}>{children}</Container>,
    scene,
    {
      events: { compute: compute as never, priority: index },
      size: { width: r?.width ?? size.width, height: r?.height ?? size.height, top: r?.top ?? 0, left: r?.left ?? 0 },
    },
  );
}

function Container({ track, rect, index, children }: {
  track: RefObject<HTMLElement>; rect: RefObject<DOMRect | null>; index: number; children: ReactNode;
}) {
  const get = useThree((s) => s.get);
  const setEvents = useThree((s) => s.setEvents);

  useFrame((state) => {
    const el = track.current;
    if (!el) return;
    const t = el.getBoundingClientRect();
    (rect as { current: DOMRect | null }).current = t;
    const c = state.gl.domElement.getBoundingClientRect();
    if (t.width <= 0 || t.height <= 0) return;
    if (t.right < c.left || t.left > c.right || t.bottom < c.top || t.top > c.bottom) return; // truly offscreen
    const left = t.left - c.left, bottom = c.bottom - t.bottom;
    const cam = state.camera as { aspect?: number; updateProjectionMatrix(): void };
    const aspect = t.width / t.height;
    if (cam.aspect !== undefined && cam.aspect !== aspect) { cam.aspect = aspect; cam.updateProjectionMatrix(); }
    const autoClear = state.gl.autoClear;
    state.gl.autoClear = false;
    state.gl.setViewport(left, bottom, t.width, t.height);
    state.gl.setScissor(left, bottom, t.width, t.height);
    state.gl.setScissorTest(true);
    state.gl.render(state.scene, state.camera); // the scene's colour background clears this rect
    state.gl.setScissorTest(false);
    state.gl.autoClear = autoClear;
  }, index);

  // Route pointer events through this view's track while it is mounted.
  useEffect(() => {
    const old = get().events.connected;
    setEvents({ connected: track.current });
    return () => setEvents({ connected: old });
  }, [track, get, setEvents]);

  return <>{children}</>;
}
