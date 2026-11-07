import { dateText } from '../../lib/format.ts';
import { MILESTONES } from './replayData.ts';
import type { Milestone } from './replayData.ts';

export function MilestoneStrip({ active, onSelect }: { active: Milestone['id']; onSelect: (id: Milestone['id']) => void }) {
  return (
    <ol aria-label="Replay milestones" className="grid grid-cols-4 gap-4 border-t-2 border-border pt-3">
      {MILESTONES.map((m) => {
        const on = m.id === active;
        return (
          <li key={m.id}>
            <button type="button" aria-current={on ? 'step' : undefined} onClick={() => onSelect(m.id)}
              className={`w-full rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verified ${on ? 'border-verified bg-panel-2' : 'border-border bg-panel hover:border-text-3'}`}>
              <span className="block text-xs font-medium text-text-2">{dateText(m.date)}</span>
              <span className="block text-base font-semibold text-text">{m.title}</span>
              <span className="mt-1 block text-sm text-text-2">{m.text}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
