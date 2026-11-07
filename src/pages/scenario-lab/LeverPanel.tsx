import { useEffect, useState } from 'react';
import { LEVER_CATALOGUE } from '@engine/index.ts';
import type { InputBundle, Lever, LeverKind, LeverSet } from '@engine/index.ts';
import { LeverControls } from './controls/LeverControls.tsx';
import { defaultLever } from './leverDefaults.ts';
import { Bus, Building2, GraduationCap, UtensilsCrossed, Users } from 'lucide-react';

const TEAMS = [
  { id: 'academic', title: 'Academic', Icon: GraduationCap },
  { id: 'transport', title: 'Transport', Icon: Bus },
  { id: 'cafeteria', title: 'Cafeteria', Icon: UtensilsCrossed },
  { id: 'facilities', title: 'Facilities', Icon: Building2 },
  { id: 'whatif', title: 'What-if', Icon: Users },
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
    <div className="flex flex-col gap-5">
      <div className="card p-4">
        <h2 className="section-title">Actions to try</h2>
        <p className="mt-1 text-sm text-text-2">
          {levers.length === 0
            ? 'Tick any action below. The “With plan” view and every chart update straight away.'
            : `${levers.length} ${levers.length === 1 ? 'action is' : 'actions are'} on. Adjust the times, or tick more.`}
        </p>
      </div>
      {TEAMS.map((team) => (
        <section key={team.id} aria-labelledby={`team-${team.id}`}>
          <h2 id={`team-${team.id}`} className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-text-2">
            <team.Icon aria-hidden="true" className="h-4 w-4 text-text-3" />{team.title}
          </h2>
          <div className="flex flex-col gap-2">
            {LEVER_CATALOGUE.filter((s) => s.team === team.id).map((spec) => {
              const lever = levers.find((l) => l.kind === spec.kind);
              const ring = ringed.includes(spec.kind);
              const id = `lever-${spec.kind}`;
              return (
                <article key={spec.kind} data-testid={id} data-ring={ring ? 'on' : 'off'}
                  className={`rounded-xl border p-3 transition-colors ${ring ? 'border-ai bg-ai/10 ring-2 ring-ai' : lever ? 'border-accent/60 bg-accent-soft/40' : 'border-border bg-panel hover:border-border-strong'}`}>
                  <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
                    <input id={id} type="checkbox" checked={lever !== undefined}
                      className="h-4 w-4"
                      onChange={(e) => (e.target.checked ? onUpsert(defaultLever(spec.kind, bundle)) : onRemove(spec.kind))} />
                    <span className="text-sm font-medium text-text">{spec.title}</span>
                  </label>
                  <p className="mt-1 pl-6 text-xs leading-relaxed text-text-3">{spec.description}</p>
                  {lever && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
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
