import { createRef, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CameraControls, PerspectiveCamera } from '@react-three/drei';
import { Vector3 } from 'three';
import type { Forecast } from '@engine/index.ts';
import { lightingAt, type Lighting } from './lighting.ts';
import { CampusScene } from './CampusScene.tsx';
import { useCameraStore } from './cameraStore.ts';
import { TrackedView } from './TrackedView.tsx';
import { useTimeStore } from '../store/time.ts';
import type { CameraPresetId, Vec3 } from './cameraPresets.ts';

interface CampusView { forecast: Forecast; caption?: string }

export interface CampusCanvasProps {
  views: CampusView[];
  step: number;
  cameraPreset?: CameraPresetId;
  onZoneClick?: (zoneId: string) => void;
  /** Zone to outline in white (optional). */
  selectedZone?: string | null;
  /** Hourly precipitation (20 points) for rain. */
  weatherMm?: (number | null)[];
  /** A click that hit no zone (empty ground or sky); drags don't count. */
  onEmptyClick?: () => void;
}

/** One shared WebGL canvas behind one HTML container per view; each view renders through `TrackedView`. */
export function CampusCanvas({ views, step, cameraPreset, onZoneClick, selectedZone = null, weatherMm, onEmptyClick }: CampusCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null!);
  // One stable track ref per view index, so a view keeps its track (and controls) when the view count changes.
  const trackStore = useRef<RefObject<HTMLElement>[]>([]);
  while (trackStore.current.length < views.length) trackStore.current.push(createRef<HTMLElement>() as RefObject<HTMLElement>);
  const trackRefs = trackStore.current;
  const lighting = useMemo(() => lightingAt(step), [step]);
  // Spec §10: render continuously only while the timeline plays; otherwise render on demand.
  const playing = useTimeStore((s) => s.playing);
  // Where the pointer went down, so the click that ends an orbit drag over empty sky doesn't clear the selection.
  const down = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (cameraPreset) useCameraStore.getState().goTo(cameraPreset);
  }, [cameraPreset]);

  return (
    <div ref={containerRef} className="relative h-full w-full"
      onPointerDownCapture={(e) => { down.current = { x: e.clientX, y: e.clientY }; }}>
      <div className={`relative z-10 grid h-full gap-3 ${views.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {views.map((v, i) => (
          <div key={i} ref={trackRefs[i] as RefObject<HTMLDivElement>}
            role="img" aria-label={v.caption ? `3D campus view, ${v.caption}` : '3D campus view'}
            className="relative h-full min-h-48 overflow-hidden rounded-lg border border-border">
            {v.caption && (
              <span className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-panel/85 px-2 py-1 text-sm font-medium text-text">
                {v.caption}
              </span>
            )}
          </div>
        ))}
      </div>
      <Canvas shadows="percentage" dpr={[1, 1.5]} gl={{ antialias: true }} eventSource={containerRef}
        frameloop={playing ? 'always' : 'demand'}
        onPointerMissed={(e) => {
          const d = down.current;
          if (e.type === 'click' && (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 2)) onEmptyClick?.();
        }}
        style={{ position: 'absolute', inset: 0 }}>
        <InvalidateOn deps={[step, selectedZone, views, weatherMm]} />
        {views.map((_, i) => (
          <TrackedView key={i} track={trackRefs[i]!} index={i + 1}>
            <SyncedCamera viewIndex={i} track={trackRefs[i]!} />
            <SceneLights lighting={lighting} />
            <CampusScene forecast={views[i]!.forecast} step={step} selectedZone={selectedZone} weatherMm={weatherMm}
              onZoneClick={onZoneClick} onGroundClick={onEmptyClick} />
          </TrackedView>
        ))}
      </Canvas>
    </div>
  );
}

/** Requests a frame whenever one of `deps` changes (demand frameloop: instanced fx and labels update in useFrame). */
function InvalidateOn({ deps }: { deps: unknown[] }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { invalidate(); }, [invalidate, ...deps]);
  return null;
}

/**
 * Camera for one view, kept in sync through `useCameraStore`:
 * - user input (`control`) makes this view active and it publishes its pose on every change (incl. damping);
 * - while another view is active, this view copies the store pose each frame without transition;
 * - `goTo` (activeView = null) makes every view animate itself to the preset.
 */
function SyncedCamera({ viewIndex, track }: { viewIndex: number; track: RefObject<HTMLElement> }) {
  // State, not a ref: drei recreates the controls when the view's default camera changes, so the effect must re-run.
  const [controls, setControls] = useState<CameraControls | null>(null);
  const copied = useRef<{ position: Vec3; target: Vec3 } | null>(null);
  const pos = useMemo(() => new Vector3(), []);
  const tgt = useMemo(() => new Vector3(), []);
  const invalidate = useThree((s) => s.invalidate);

  // A view that unmounts must not stay the active view, or the remaining views would follow a stale leader.
  useEffect(() => () => useCameraStore.getState().release(viewIndex), [viewIndex]);

  useEffect(() => {
    const c = controls;
    if (!c) return;
    const s = useCameraStore.getState();
    void c.setLookAt(...s.position, ...s.target, false);
    return useCameraStore.subscribe((next, prev) => {
      if (next.activeView === null && (next.position !== prev.position || next.target !== prev.target)) {
        void c.setLookAt(...next.position, ...next.target, true);
      }
    });
  }, [controls]);

  useFrame(() => {
    const c = controls;
    const s = useCameraStore.getState();
    if (!c || s.activeView === null || s.activeView === viewIndex) return;
    if (copied.current?.position === s.position && copied.current.target === s.target) return;
    copied.current = { position: s.position, target: s.target };
    void c.setLookAt(...s.position, ...s.target, false);
    invalidate(); // demand frameloop: render the copied pose (this view's controls apply it next frame)
  });

  const publish = (claim: boolean) => {
    const c = controls;
    if (!c) return;
    const s = useCameraStore.getState();
    if (!claim && s.activeView !== viewIndex) return;
    c.getPosition(pos);
    c.getTarget(tgt);
    s.setPose([pos.x, pos.y, pos.z], [tgt.x, tgt.y, tgt.z], viewIndex);
  };

  return (
    <>
      <PerspectiveCamera makeDefault fov={40} near={0.5} far={2000} />
      <CameraControls ref={setControls} makeDefault domElement={track.current ?? undefined}
        onControl={() => publish(true)} onChange={() => publish(false)} />
    </>
  );
}

function SceneLights({ lighting }: { lighting: Lighting }) {
  const [x, y, z] = lighting.sunDir;
  return (
    <>
      <color attach="background" args={[lighting.skyColor]} />
      <ambientLight intensity={lighting.ambient} />
      <directionalLight castShadow position={[x * 200, y * 200, z * 200]}
        intensity={lighting.sunIntensity} color={lighting.sunColor}
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005}
        shadow-camera-left={-170} shadow-camera-right={170}
        shadow-camera-top={170} shadow-camera-bottom={-170}
        shadow-camera-near={1} shadow-camera-far={600} />
    </>
  );
}
