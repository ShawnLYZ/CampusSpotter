import type { SourceInfo } from '../providers/types.ts';
import { durationText } from '../lib/format.ts';
import { TriangleAlert } from 'lucide-react';

export function StaleBanner({ sources }: { sources: SourceInfo[] }) {
  const bad = sources.filter((s) => s.status === 'stale' || s.status === 'failed');
  if (bad.length === 0) return null;
  return (
    <div role="status" className="rounded-xl border border-amber/50 bg-amber/10 px-4 py-2.5 text-sm text-amber-ink">
      {bad.map((s) => (
        <p key={s.id} className="flex items-center gap-2">
          <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
          Data may be out of date: {s.name} last updated {s.ageHours === null ? 'an unknown time' : durationText(Math.round(s.ageHours * 60))} ago
        </p>
      ))}
    </div>
  );
}
