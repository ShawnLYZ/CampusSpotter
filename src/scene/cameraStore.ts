import { create } from 'zustand';
import { CAMERA_PRESETS, type CameraPresetId, type Vec3 } from './cameraPresets.ts';

interface CameraState {
  position: Vec3;
  target: Vec3;
  preset: CameraPresetId;
  /** The view the user is steering; the other views follow it. `null` while a preset transition runs. */
  activeView: number | null;
  setPose(p: Vec3, t: Vec3, from: number): void;
  goTo(preset: CameraPresetId): void;
  /** Drop `view` as the active view (it unmounted); the pose stays, so nothing moves. */
  release(view: number): void;
}

const INITIAL: CameraPresetId = 'overview';

export const useCameraStore = create<CameraState>((set) => ({
  position: [...CAMERA_PRESETS[INITIAL].position],
  target: [...CAMERA_PRESETS[INITIAL].target],
  preset: INITIAL,
  activeView: null,
  setPose: (p, t, from) => set({ position: p, target: t, activeView: from }),
  goTo: (preset) => set({
    position: [...CAMERA_PRESETS[preset].position],
    target: [...CAMERA_PRESETS[preset].target],
    preset,
    activeView: null,
  }),
  release: (view) => set((s) => (s.activeView === view ? { activeView: null } : {})),
}));
