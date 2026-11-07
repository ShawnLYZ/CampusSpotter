import { CircleHelp } from 'lucide-react';
import { PressureBadge } from './PressureBadge.tsx';
import { ProvenanceBadge } from './ProvenanceBadge.tsx';
import { useGuide } from '../app/guide.ts';

/** One-line key to the two colour systems, with a link to the full guide. */
export function Legend({ className = '' }: { className?: string }) {
  const open = useGuide((s) => s.open);
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-2 ${className}`}>
      <span className="flex items-center gap-1.5">
        <span className="mr-0.5 font-medium text-text-3">Status</span>
        <PressureBadge pressure="green" status="ok" size="sm" />
        <PressureBadge pressure="amber" status="ok" size="sm" />
        <PressureBadge pressure="red" status="ok" size="sm" />
      </span>
      <span className="flex items-center gap-1.5">
        <span className="mr-0.5 font-medium text-text-3">Source</span>
        <ProvenanceBadge label="verified" />
        <ProvenanceBadge label="baseline" />
        <ProvenanceBadge label="ai" />
      </span>
      <button type="button" onClick={open} className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline">
        <CircleHelp aria-hidden="true" className="h-3.5 w-3.5" /> What do these mean?
      </button>
    </div>
  );
}
