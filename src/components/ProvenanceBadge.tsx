import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { InputBundle, Label } from '@engine/index.ts';
import { describeInputs } from '../lib/provenance.ts';
import { stampText } from '../lib/format.ts';
import type { SourceInfo } from '../providers/types.ts';

const STYLE: Record<Label, { word: string; dot: string }> = {
  verified: { word: 'Verified', dot: 'bg-verified' },
  baseline: { word: 'Baseline', dot: 'bg-baseline' },
  ai: { word: 'AI-estimated', dot: 'bg-ai' },
};
const BORDER: Record<Label, string> = { verified: 'border-verified', baseline: 'border-baseline', ai: 'border-ai' };

export function ProvenanceBadge({ label, inputs, bundle, sources }: {
  label: Label | null; inputs?: string[]; bundle?: InputBundle; sources?: SourceInfo[];
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const popId = useId();

  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) { setPos(null); return; }
    const r = btn.current.getBoundingClientRect();
    const w = pop.current.offsetWidth, h = pop.current.scrollHeight;
    const vw = window.innerWidth, vh = window.innerHeight, m = 8;
    let left = r.left;
    if (left + w > vw - m) left = r.right - w;
    left = Math.max(m, Math.min(left, vw - w - m));
    let top = r.bottom + m;
    if (top + h > vh - m && r.top - m - h >= m) top = r.top - m - h;
    top = Math.max(m, Math.min(top, vh - h - m));
    setPos({ left, top, maxH: vh - 2 * m });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (root.current?.contains(t) || pop.current?.contains(t)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    const onScroll = (e: Event) => { if (!pop.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', close); window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  if (!label) return null;
  const s = STYLE[label];
  if (!inputs || !bundle) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border bg-panel-2 px-2.5 py-0.5 text-sm text-text ${BORDER[label]}`}>
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${s.dot}`} />
        {s.word}
      </span>
    );
  }
  const items = open ? describeInputs(inputs, bundle, sources) : [];
  return (
    <span ref={root} className="relative inline-block">
      <button
        ref={btn} type="button" aria-expanded={open} aria-controls={open ? popId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border bg-panel-2 px-2.5 py-0.5 text-sm text-text ${BORDER[label]}`}
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${s.dot}`} />
        {s.word}
      </button>
      {open && createPortal(
        <div ref={pop} id={popId} role="region" aria-label={`${s.word} inputs`}
          style={{ position: 'fixed', left: pos?.left ?? 0, top: pos?.top ?? 0, maxHeight: pos?.maxH, visibility: pos ? 'visible' : 'hidden' }}
          className="z-[1000] w-96 max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-border bg-panel-2 p-3 text-left text-sm shadow-xl">
          <p className="mb-2 font-semibold text-text">Inputs behind this figure</p>
          {items.length === 0 && <p className="text-text-2">No inputs recorded.</p>}
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text">{it.title}</span>
                  <span className="flex items-center gap-1 text-xs text-text-2">
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STYLE[it.label].dot}`} />{STYLE[it.label].word}
                  </span>
                </div>
                <div className="text-xs text-text-2">
                  {it.source}{it.lastUpdated ? ` · updated ${stampText(it.lastUpdated)}` : ''}{it.range ? ` · ${it.range}` : ''}
                </div>
                {it.reasoning && <p className="mt-1 text-xs text-text-2">{it.reasoning}</p>}
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </span>
  );
}
