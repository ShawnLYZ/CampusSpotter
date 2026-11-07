import { CircleCheck, OctagonAlert, ShieldAlert, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RiskLevel } from '@engine/index.ts';

const STYLE: Record<RiskLevel, { word: string; Icon: LucideIcon; cls: string }> = {
  low: { word: 'Low risk', Icon: CircleCheck, cls: 'border-green/40 bg-green/10 text-green-ink' },
  medium: { word: 'Medium risk', Icon: TriangleAlert, cls: 'border-amber/50 bg-amber/12 text-amber-ink' },
  high: { word: 'High risk', Icon: OctagonAlert, cls: 'border-red/60 bg-red/15 text-red-ink' },
  critical: { word: 'Critical', Icon: ShieldAlert, cls: 'border-[#dc2626] bg-critical text-white' },
};

export function RiskBadge({ level, reason }: { level: RiskLevel | null; reason?: string }) {
  if (!level) {
    return <span className="inline-flex shrink-0 rounded-md border border-border-strong px-2 py-0.5 text-sm text-text-2" title={reason}>Not assessed</span>;
  }
  const s = STYLE[level];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-sm font-medium ${s.cls}`} title={reason}>
      <s.Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
      {s.word}
    </span>
  );
}
