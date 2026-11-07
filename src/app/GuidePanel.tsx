import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, X } from 'lucide-react';
import { PressureBadge } from '../components/PressureBadge.tsx';
import { ProvenanceBadge } from '../components/ProvenanceBadge.tsx';
import { RiskBadge } from '../components/RiskBadge.tsx';
import { useGuide } from './guide.ts';

const WORKFLOW = [
  { to: '/early-warning', page: 'Early Warning', text: 'See which days are coming up that could overload the shuttle or campus, and how risky each one is.' },
  { to: '/', page: 'Command Center', text: 'Check how a day will unfold. Drag the time slider and watch the 3D campus change colour.' },
  { to: '/scenario-lab', page: 'Scenario Lab', text: 'Tick actions such as extra buses or online classes, or just ask a question. Both futures update instantly.' },
  { to: '/action-plans', page: 'Action Plans', text: 'Get three ready plans within your budget, choose one, and get a checklist per team plus a student message.' },
];

const WORDS = [
  ['Disruption', 'Anything that may overload the campus or shuttle on a day: a stadium concert, heavy rain, Friday prayer, an intake day.'],
  ['Action (lever)', 'Something management can do, such as adding buses, opening a waiting hall or moving classes online.'],
  ['No action vs With plan', 'The same day computed twice: once as it would go if nothing changes, once with your chosen actions.'],
  ['Time step', 'Forecasts move in 15-minute steps from 7:00 AM to 2:00 AM.'],
] as const;

/** "How it works" side panel for first-time visitors and judges. */
export function GuidePanel() {
  const isOpen = useGuide((s) => s.isOpen);
  const close = useGuide((s) => s.close);
  const navigate = useNavigate();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    opener.current = document.activeElement;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [isOpen, close]);

  if (!isOpen) return null;
  const go = (to: string) => { close(); void navigate(to); };

  return (
    <div className="fixed inset-0 z-[900]">
      <div className="absolute inset-0 bg-black/55" onClick={close} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-labelledby="guide-h"
        className="absolute inset-y-0 right-0 flex w-[460px] max-w-full flex-col border-l border-border-strong bg-panel shadow-[var(--shadow-pop)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 id="guide-h" className="text-lg font-medium">How CampusSpotter works</h2>
            <p className="mt-1 text-sm text-text-2">See it coming, test the response, act early.</p>
          </div>
          <button ref={closeBtn} type="button" onClick={close} className="btn btn-quiet btn-sm" aria-label="Close guide"><X aria-hidden="true" /></button>
        </div>
        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6 text-sm">
          <section>
            <h3 className="section-title mb-3">Four steps, four pages</h3>
            <ol className="space-y-2">
              {WORKFLOW.map((w, i) => (
                <li key={w.to}>
                  <button type="button" onClick={() => go(w.to)}
                    className="group flex w-full items-start gap-3 rounded-xl border border-border bg-panel-2 p-3 text-left transition-colors hover:border-accent/60">
                    <span className="figure grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border-strong text-xs text-text-2">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-medium text-text">{w.page}
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-text-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                      </span>
                      <span className="mt-0.5 block text-text-2">{w.text}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="section-title mb-1">What the colours mean</h3>
            <p className="mb-3 text-text-2">Every place and number is rated at each time of day. Colour always comes with an icon and a word.</p>
            <dl className="space-y-2">
              <div className="flex items-center gap-3"><dt className="w-32 shrink-0"><PressureBadge pressure="green" status="ok" /></dt><dd className="text-text-2">Coping fine.</dd></div>
              <div className="flex items-center gap-3"><dt className="w-32 shrink-0"><PressureBadge pressure="amber" status="ok" /></dt><dd className="text-text-2">Getting crowded; keep an eye on it.</dd></div>
              <div className="flex items-center gap-3"><dt className="w-32 shrink-0"><PressureBadge pressure="red" status="ok" /></dt><dd className="text-text-2">Over capacity; students are stuck or waiting long.</dd></div>
            </dl>
          </section>

          <section>
            <h3 className="section-title mb-1">Where each number comes from</h3>
            <p className="mb-3 text-text-2">Click any of these labels next to a number to see its sources.</p>
            <dl className="space-y-2">
              <div className="flex items-center gap-3"><dt className="w-32 shrink-0"><ProvenanceBadge label="verified" /></dt><dd className="text-text-2">Public or official data, such as JAKIM prayer times or Google traffic.</dd></div>
              <div className="flex items-center gap-3"><dt className="w-32 shrink-0"><ProvenanceBadge label="baseline" /></dt><dd className="text-text-2">An assumed APU figure, such as room seats. Replace it on Data &amp; Assumptions.</dd></div>
              <div className="flex items-center gap-3"><dt className="w-32 shrink-0"><ProvenanceBadge label="ai" /></dt><dd className="text-text-2">Estimated by Gemini, always with its reasoning and a range.</dd></div>
            </dl>
          </section>

          <section>
            <h3 className="section-title mb-1">Risk for a whole day</h3>
            <p className="mb-3 text-text-2">Worked out from the day with no action taken.</p>
            <div className="flex flex-wrap gap-2">
              <RiskBadge level="low" /><RiskBadge level="medium" /><RiskBadge level="high" /><RiskBadge level="critical" />
            </div>
          </section>

          <section>
            <h3 className="section-title mb-3">Words you will see</h3>
            <dl className="space-y-3">
              {WORDS.map(([w, d]) => (
                <div key={w}><dt className="font-medium text-text">{w}</dt><dd className="text-text-2">{d}</dd></div>
              ))}
            </dl>
          </section>
        </div>
      </aside>
    </div>
  );
}
