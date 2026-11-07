import { Check } from 'lucide-react';
import type { DisruptionType, RiskLevel } from '@engine/index.ts';

export const TYPE_CHIPS: { value: DisruptionType; label: string }[] = [
  { value: 'stadium_event', label: 'Stadium event' },
  { value: 'apu_calendar', label: 'APU calendar' },
  { value: 'weekly_pattern', label: 'Weekly pattern' },
  { value: 'weather', label: 'Weather' },
  { value: 'manual', label: 'Manual' },
];
export const RISK_CHIPS: { value: RiskLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="chip">
      {on && <Check aria-hidden="true" className="h-3.5 w-3.5 text-text" />}{label}
    </button>
  );
}

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set);
  if (n.has(v)) n.delete(v); else n.add(v);
  return n;
}

export function FilterBar({ types, risks, onTypes, onRisks }: {
  types: Set<DisruptionType>; risks: Set<RiskLevel>; onTypes: (s: Set<DisruptionType>) => void; onRisks: (s: Set<RiskLevel>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div role="group" aria-label="Filter by type" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-text-3">Show type</span>
        {TYPE_CHIPS.map((c) => <Chip key={c.value} label={c.label} on={types.has(c.value)} onClick={() => onTypes(toggle(types, c.value))} />)}
      </div>
      <div role="group" aria-label="Filter by risk" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-text-3">Risk</span>
        {RISK_CHIPS.map((c) => <Chip key={c.value} label={c.label} on={risks.has(c.value)} onClick={() => onRisks(toggle(risks, c.value))} />)}
      </div>
    </div>
  );
}
