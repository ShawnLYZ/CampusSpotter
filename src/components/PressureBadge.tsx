import { CircleCheck, CircleHelp, CircleSlash, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Pressure, StepStatus } from '@engine/index.ts';
import { pressureText } from '../lib/format.ts';

/** Pressure is always colour + icon + word (PRD §3.14), so it reads without colour too. */
export const PRESSURE_STYLE: Record<Pressure, { Icon: LucideIcon; cls: string; ink: string; word: string; tint: string }> = {
  green: { Icon: CircleCheck, cls: 'border-green/40 bg-green/10 text-green-ink', ink: 'text-green', word: 'text-green-ink', tint: 'bg-green/[0.06]' },
  amber: { Icon: TriangleAlert, cls: 'border-amber/50 bg-amber/12 text-amber-ink', ink: 'text-amber', word: 'text-amber-ink', tint: 'bg-amber/[0.08]' },
  red: { Icon: OctagonAlert, cls: 'border-red/60 bg-red/15 text-red-ink', ink: 'text-red', word: 'text-red-ink', tint: 'bg-red/[0.10]' },
};

export function PressureBadge({ pressure, status, size = 'md' }: { pressure: Pressure | null; status: StepStatus; size?: 'sm' | 'md' }) {
  let Icon: LucideIcon, word: string, cls: string;
  if (pressure) {
    Icon = PRESSURE_STYLE[pressure].Icon; word = pressureText(pressure); cls = PRESSURE_STYLE[pressure].cls;
  } else if (status === 'no_service') {
    Icon = CircleSlash; word = 'No service'; cls = 'border-border-strong text-text-2';
  } else {
    Icon = CircleHelp; word = 'Not enough data'; cls = 'border-border-strong text-text-2';
  }
  const sz = size === 'sm' ? 'gap-1 px-1.5 py-0.5 text-xs' : 'gap-1.5 px-2 py-0.5 text-sm';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md border font-medium ${sz} ${cls}`}>
      <Icon aria-hidden="true" className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2} />
      <span>{word}</span>
    </span>
  );
}
