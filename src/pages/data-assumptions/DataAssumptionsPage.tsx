import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { usePresenterAction } from '../../presenter/usePresenterAction.ts';
import { SourcesTab } from './SourcesTab.tsx';
import { BaselineTab } from './BaselineTab.tsx';
import { EstimatesTab } from './EstimatesTab.tsx';
import { RulesTab } from './RulesTab.tsx';
import { PrivacyTab } from './PrivacyTab.tsx';
import { AboutTab } from './AboutTab.tsx';
import { Database } from 'lucide-react';
import { PageIntro } from '../../components/PageIntro.tsx';

const TABS = [
  { id: 'sources', title: 'Sources', Panel: SourcesTab },
  { id: 'baseline', title: 'Baseline', Panel: BaselineTab },
  { id: 'estimates', title: 'AI estimates', Panel: EstimatesTab },
  { id: 'rules', title: 'Rules', Panel: RulesTab },
  { id: 'privacy', title: 'Privacy', Panel: PrivacyTab },
  { id: 'about', title: 'About', Panel: AboutTab },
] as const;

export default function DataAssumptionsPage() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  usePresenterAction('data.tab', (a) => setActive(Math.max(0, TABS.findIndex((t) => t.id === a.tab))));

  const onKey = (e: KeyboardEvent) => {
    const n = TABS.length;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (active + 1) % n;
    else if (e.key === 'ArrowLeft') next = (active - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };

  const { Panel } = TABS[active];
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageIntro id="data" Icon={Database} title="Data & Assumptions"
        summary="Every input behind the forecasts: where it comes from, how fresh it is, and which figures are assumptions you can replace." />
      <div role="tablist" aria-label="Data and assumptions" onKeyDown={onKey} className="flex gap-1 border-b border-border">
        {TABS.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`tab-${t.id}`}
            aria-selected={i === active} aria-controls={`panel-${t.id}`} tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-offset-[-2px] ${
              i === active ? 'border-accent text-text' : 'border-transparent text-text-2 hover:border-border-strong hover:text-text'}`}>
            {t.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${TABS[active].id}`} aria-labelledby={`tab-${TABS[active].id}`} tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto pr-1">
        <Panel />
      </div>
    </div>
  );
}
