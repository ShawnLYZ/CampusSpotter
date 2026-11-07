import { CircleHelp } from 'lucide-react';
import { PRESSURE_STYLE } from './PressureBadge.tsx';
import { useGuide } from '../app/guide.ts';

const PRESSURE_KEY = [['green', 'Normal'], ['amber', 'Busy'], ['red', 'Overloaded']] as const;
const SOURCE_KEY = [['bg-verified', 'Verified'], ['bg-baseline', 'Baseline'], ['bg-ai', 'AI-estimated']] as const;

/** One-line key to the two colour systems, with a link to the full guide. Kept plain so the badges it explains stand out. */
export function Legend({ className = '' }: { className?: string }) {
  const open = useGuide((s) => s.open);
  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-2 ${className}`}>
      <span className="flex items-center gap-3">
        <span className="text-text-3">Status</span>
        {PRESSURE_KEY.map(([p, word]) => {
          const { Icon, ink } = PRESSURE_STYLE[p];
          return (
            <span key={p} className="inline-flex items-center gap-1">
              <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${ink}`} strokeWidth={2} />{word}
            </span>
          );
        })}
      </span>
      <span className="flex items-center gap-3">
        <span className="text-text-3">Source</span>
        {SOURCE_KEY.map(([dot, word]) => (
          <span key={word} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />{word}
          </span>
        ))}
      </span>
      <button type="button" onClick={open} className="inline-flex items-center gap-1 text-text-2 underline decoration-border-strong underline-offset-4 transition-colors hover:text-text hover:decoration-text-3">
        <CircleHelp aria-hidden="true" className="h-3.5 w-3.5" /> What do these mean?
      </button>
    </div>
  );
}
