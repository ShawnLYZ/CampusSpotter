import type { RiskLevel } from '@engine/index.ts';

const STYLE: Record<RiskLevel, { word: string; cls: string }> = {
  low: { word: 'Low', cls: 'border-green/60 text-green' },
  medium: { word: 'Medium', cls: 'border-amber/60 text-amber' },
  high: { word: 'High', cls: 'border-red/70 text-red' },
  critical: { word: 'Critical', cls: 'border-critical bg-critical text-white' },
};

export function RiskBadge({ level, reason }: { level: RiskLevel | null; reason?: string }) {
  if (!level) {
    return <span className="inline-flex rounded-md border border-border px-2 py-0.5 text-sm text-text-2" title={reason}>Not assessed</span>;
  }
  const s = STYLE[level];
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-sm font-semibold ${s.cls}`} title={reason}>
      {s.word}
    </span>
  );
}
