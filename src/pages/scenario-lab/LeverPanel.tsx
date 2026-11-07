import { useEffect, useState } from 'react';
import { LEVER_CATALOGUE } from '@engine/index.ts';
import type { InputBundle, Lever, LeverKind, LeverSet } from '@engine/index.ts';
import { LeverControls } from './controls/LeverControls.tsx';
import { defaultLever } from './leverDefaults.ts';

const TEAMS = [
  { id: 'academic', title: 'Academic' },
  { id: 'transport', title: 'Transport' },
  { id: 'cafeteria', title: 'Cafeteria' },
  { id: 'facilities', title: 'Facilities' },
  { id: 'whatif', title: 'What-if' },
] as const;

const RING_MS = 4000;

interface Props {
  levers: LeverSet; highlighted: LeverKind[]; bundle: InputBundle;
  onUpsert: (l: Lever) => void; onRemove: (k: LeverKind) => void;
}

export function LeverPanel({ levers, highlighted, bundle, onUpsert, onRemove }: Props) {
  const [ringed, setRinged] = useState<LeverKind[]>([]);
  useEffect(() => {
    if (highlighted.length === 0) { setRinged([]); return; }
    setRinged(highlighted);
    const t = window.setTimeout(() => setRinged([]), RING_MS);
    return () => window.clearTimeout(t);
  }, [highlighted]);

  return (
    <div className="flex flex-col gap-4">
      {TEAMS.map((team) => (
        <section key={team.id} aria-labelledby={`team-${team.id}`}>
          <h2 id={`team-${team.id}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-2">{team.title}</h2>
          <div className="flex flex-col gap-2">
            {LEVER_CATALOGUE.filter((s) => s.team === team.id).map((spec) => {
              const lever = levers.find((l) => l.kind === spec.kind);
              const ring = ringed.includes(spec.kind);
              const id = `lever-${spec.kind}`;
              return (
                <article key={spec.kind} data-testid={id} data-ring={ring ? 'on' : 'off'}
                  className={`rounded-lg border bg-panel p-3 ${ring ? 'border-ai ring-2 ring-ai' : lever ? 'border-verified/60' : 'border-border'}`}>
                  <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
                    <input id={id} type="checkbox" checked={lever !== undefined}
                      className="h-4 w-4 accent-[#3b82f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verified"
                      onChange={(e) => (e.target.checked ? onUpsert(defaultLever(spec.kind, bundle)) : onRemove(spec.kind))} />
                    <span className="text-sm font-medium text-text">{spec.title}</span>
                  </label>
                  <p className="mt-1 text-xs text-text-3">{spec.description}</p>
                  {lever && (
                    <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
                      <LeverControls lever={lever} bundle={bundle} onChange={onUpsert} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
