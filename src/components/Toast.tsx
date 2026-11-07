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
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-border-strong bg-panel-3 px-4 py-2.5 text-sm font-medium text-text shadow-[var(--shadow-pop)]">
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />{message}
    </div>
  );
}
