import { useEffect, useRef } from 'react';

/** Transient status message; auto-dismisses after ~3 s. Render only while a message exists. */
export function Toast({ message, onDone, ms = 3000 }: { message: string; onDone: () => void; ms?: number }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), ms);
    return () => clearTimeout(t);
  }, [message, ms]);
  return (
    <div role="status" aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-panel-2 px-4 py-2 text-sm text-text shadow-xl">
      {message}
    </div>
  );
}
