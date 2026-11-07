import type { Pressure, StepStatus } from '@engine/index.ts';
import { pressureText } from '../lib/format.ts';

const STYLE: Record<Pressure, { icon: string; cls: string }> = {
  green: { icon: '●', cls: 'text-green border-green/50' },
  amber: { icon: '▲', cls: 'text-amber border-amber/50' },
  red: { icon: '■', cls: 'text-red border-red/50' },
};

export function PressureBadge({ pressure, status }: { pressure: Pressure | null; status: StepStatus }) {
  let icon: string, word: string, cls: string;
  if (pressure) {
    icon = STYLE[pressure].icon; word = pressureText(pressure); cls = STYLE[pressure].cls;
  } else if (status === 'no_service') {
    icon = '○'; word = 'No service'; cls = 'text-text-2 border-border';
  } else {
    icon = '?'; word = 'Not enough data'; cls = 'text-text-2 border-border';
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${cls}`}>
      <span aria-hidden="true">{icon}</span>
      <span>{word}</span>
    </span>
  );
}
