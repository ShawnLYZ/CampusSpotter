import { useEffect, useRef, useState } from 'react';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function TypedText({ text, cps = 40, onDone }: { text: string; cps?: number; onDone?: () => void }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? text.length : 0));
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (reducedMotion() || text.length === 0) {
      setShown(text.length);
      done.current?.();
      return;
    }
    setShown(0);
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= text.length) { window.clearInterval(id); done.current?.(); }
    }, 1000 / cps);
    return () => window.clearInterval(id);
  }, [text, cps]);
  return <span aria-label={text}><span aria-hidden="true">{text.slice(0, shown)}</span></span>;
}
