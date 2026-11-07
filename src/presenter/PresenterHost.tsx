import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useCameraStore } from '../scene/cameraStore.ts';
import { useContextStore } from '../store/context.ts';
import { useLeverStore } from '../store/levers.ts';
import { useTimeStore } from '../store/time.ts';
import { applyStep } from './applyStep.ts';
import { presenterBus } from './bus.ts';
import { shouldHandleKey } from './keys.ts';
import { PRESENTER_STEPS } from './script.ts';
import { usePresenterStore } from './store.ts';

/** Hidden presenter mode: keyboard control plus a 40%-opacity step dot. Renders nothing while inactive. */
export function PresenterHost() {
  const navigate = useNavigate();
  const active = usePresenterStore((s) => s.active);
  const index = usePresenterStore((s) => s.index);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const act = shouldHandleKey({ key: e.key, altKey: e.altKey, shiftKey: e.shiftKey, repeat: e.repeat, target: e.target as Element | null }, usePresenterStore.getState().active);
      if (!act) return;
      e.preventDefault();
      usePresenterStore.getState()[act]();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!active) return;
    return applyStep(PRESENTER_STEPS[index], {
      navigate: (r) => { void navigate(r); },
      setCtx: useContextStore.getState().setCtx,
      setLevers: (l) => useLeverStore.getState().setLevers(l),
      setStep: useTimeStore.getState().setStep,
      setRange: useTimeStore.getState().setRange,
      goTo: useCameraStore.getState().goTo,
      emit: (a) => presenterBus.emit(a),
      reset: () => presenterBus.reset(),
      schedule: (ms, fn) => { const id = window.setTimeout(fn, ms); return () => window.clearTimeout(id); },
    });
  }, [active, index, navigate]);

  if (!active) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed bottom-2 right-2 z-50 flex items-center gap-1 opacity-40">
      <span className="tabular text-[10px] text-text">{index + 1}/{PRESENTER_STEPS.length}</span>
      <span className="block h-2 w-2 rounded-full bg-text" />
    </div>
  );
}
