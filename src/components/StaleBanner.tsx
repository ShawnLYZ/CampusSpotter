import type { SourceInfo } from '../providers/types.ts';
import { durationText } from '../lib/format.ts';

export function StaleBanner({ sources }: { sources: SourceInfo[] }) {
  const bad = sources.filter((s) => s.status === 'stale' || s.status === 'failed');
  if (bad.length === 0) return null;
  return (
    <div role="status" className="rounded-lg border border-amber/60 bg-panel-2 px-4 py-2 text-sm text-amber">
      {bad.map((s) => (
        <p key={s.id}>
          <span aria-hidden="true">▲ </span>
          Data may be out of date: {s.name} last updated {s.ageHours === null ? 'an unknown time' : durationText(Math.round(s.ageHours * 60))} ago
        </p>
      ))}
    </div>
  );
}
