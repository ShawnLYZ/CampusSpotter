import { dateText } from '../../lib/format.ts';
import { MILESTONES } from './replayData.ts';
import type { Milestone } from './replayData.ts';

export function MilestoneStrip({ active, onSelect }: { active: Milestone['id']; onSelect: (id: Milestone['id']) => void }) {
  return (
    <ol aria-label="Replay milestones" className="relative grid grid-cols-4 gap-4">
      <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-[15px] h-0.5 bg-border-strong" />
      {MILESTONES.map((m, i) => {
        const on = m.id === active;
        return (
          <li key={m.id} className="relative flex flex-col items-center">
            <span aria-hidden="true" className={`tabular relative z-[1] mb-2 grid h-8 w-8 place-items-center rounded-full border-2 text-sm font-medium ${on ? 'border-accent bg-accent text-accent-ink' : 'border-border-strong bg-panel text-text-2'}`}>{i + 1}</span>
            <button type="button" aria-current={on ? 'step' : undefined} onClick={() => onSelect(m.id)}
              className={`flex w-full flex-1 flex-col justify-start rounded-xl border p-3 text-left transition-colors ${on ? 'border-accent/70 bg-accent-soft/50' : 'border-border bg-panel hover:border-border-strong'}`}>
              <span className="tabular block text-xs font-medium text-text-3">{dateText(m.date)}</span>
              <span className="block text-base font-medium text-text">{m.title}</span>
              <span className="mt-1 block text-sm text-text-2">{m.text}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
