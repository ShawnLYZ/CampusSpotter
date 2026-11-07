import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, Lightbulb, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const KEY = (id: string) => `cs.tips.${id}`;
function readHidden(id: string): boolean {
  try { return localStorage.getItem(KEY(id)) === 'hidden'; } catch { return false; }
}
function writeHidden(id: string, hidden: boolean) {
  try { if (hidden) localStorage.setItem(KEY(id), 'hidden'); else localStorage.removeItem(KEY(id)); } catch { /* storage unavailable */ }
}

interface Props {
  id: string; Icon: LucideIcon; title: string; summary: ReactNode;
  /** Short "how to use this page" steps, shown until the visitor hides them. */
  steps?: string[]; actions?: ReactNode; compact?: boolean;
}

/** Page heading: what this page is for, its main actions, and optional first-time steps. */
export function PageIntro({ id, Icon, title, summary, steps, actions, compact = false }: Props) {
  const [hidden, setHidden] = useState(() => readHidden(id));
  const toggle = (h: boolean) => { setHidden(h); writeHidden(id, h); };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-lg border border-border bg-panel text-text-2 ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}>
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h1 className={`font-medium text-text ${compact ? 'text-lg' : 'text-xl'}`}>{title}</h1>
            <p className="text-sm text-text-2">{summary}</p>
          </div>
          {steps && hidden && (
            <button type="button" className="btn btn-quiet btn-sm ml-1" onClick={() => toggle(false)}>
              <Lightbulb aria-hidden="true" /> Show tips
            </button>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {steps && !hidden && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-panel py-1 pl-4 pr-1 text-sm">
          <Lightbulb aria-hidden="true" strokeWidth={1.75} className="h-4 w-4 shrink-0 text-text-3" />
          <span className="shrink-0 font-medium text-text">How to use this page</span>
          <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-2 text-text-2">
                {i > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-text-3" />}
                <span className="figure grid h-5 w-5 place-items-center rounded border border-border-strong text-[11px] text-text-2">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => toggle(true)} aria-label="Hide tips for this page">
            <X aria-hidden="true" /> Hide
          </button>
        </div>
      )}
    </div>
  );
}
