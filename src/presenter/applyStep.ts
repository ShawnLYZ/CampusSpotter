import type { LeverSet } from '@engine/index.ts';
import type { ContextRequest } from '../providers/types.ts';
import type { CameraPresetId } from '../scene/cameraPresets.ts';
import type { PresenterAction } from './bus.ts';
import type { PresenterStep } from './script.ts';

export interface ApplyDeps {
  navigate(route: string): void;
  setCtx(ctx: ContextRequest): void;
  setLevers(l: LeverSet): void;
  setStep(n: number): void;
  setRange(r: null): void;
  goTo(preset: CameraPresetId): void;
  emit(a: PresenterAction): void;
  /** Clears held actions and tells pages to stop typing or choosing for the previous step. */
  reset(): void;
  schedule(ms: number, fn: () => void): () => void;
}

/** Re-assert the camera once the routed page (and its canvas) has had time to mount and pick its own preset. */
const CAMERA_SETTLE_MS = 800;

/** Puts the app in the step's state, schedules its actions, and returns a function that undoes all pending work. */
export function applyStep(step: PresenterStep, deps: ApplyDeps): () => void {
  deps.reset();
  deps.setCtx(step.ctx);
  deps.setLevers(step.levers);
  deps.setRange(null);
  deps.setStep(step.step);
  deps.goTo(step.cameraPreset);
  deps.navigate(step.route);
  const cancels = step.actions.map(({ atMs, action }) => deps.schedule(atMs, () => deps.emit(action)));
  cancels.push(deps.schedule(CAMERA_SETTLE_MS, () => deps.goTo(step.cameraPreset)));
  return () => { for (const c of cancels) c(); deps.reset(); };
}
