import { useEffect, useRef } from 'react';
import { presenterBus, type ActionOf, type PresenterAction } from './bus.ts';

/** Subscribe a page to one presenter action; unsubscribes on unmount. The handler may change every render. */
export function usePresenterAction<T extends PresenterAction['type']>(type: T, handler: (a: ActionOf<T>) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => presenterBus.on(type, (a) => ref.current(a)), [type]);
}

/** Run `fn` when the presenter changes step, so the page can stop timers it started for the old step. */
export function usePresenterCancel(fn: () => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => presenterBus.onCancel(() => ref.current()), []);
}
