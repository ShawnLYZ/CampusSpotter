import { useEffect, useMemo, useRef, useState } from 'react';
import { buildChecklist } from '@plans/checklist.ts';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useForecast } from '../../hooks/useForecast.ts';
import { clock12, rmText } from '../../lib/format.ts';
import { TypedText } from '../../components/TypedText.tsx';
import { Toast } from '../../components/Toast.tsx';
import type { ContextRequest, PlanProposal } from '../../providers/types.ts';
import { groupByTeam, TEAM_LABEL } from './planUtils.ts';

const btn = 'rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verified';
const NO_LEVERS: never[] = [];

interface Props { plan: PlanProposal; ctx: ContextRequest; onClose: () => void; onConfirmed: () => void }

export function DecisionView({ plan, ctx, onClose, onConfirmed }: Props) {
  const provider = useProvider();
  const fc = useForecast(ctx, NO_LEVERS);
  const ref = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [typing, setTyping] = useState(true);
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const checklist = useMemo(() => (fc.bundle ? buildChecklist(plan.levers, fc.bundle) : null), [fc.bundle, plan.levers]);
  const groups = useMemo(() => groupByTeam(checklist ?? []), [checklist]);

  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    if (!checklist) return;
    let cancelled = false;
    provider.draftAnnouncement(plan, ctx, checklist).then(
      (d) => { if (!cancelled) { setDraft(d); setText(d); setTyping(true); } },
      (e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => { cancelled = true; };
  }, [provider, plan, ctx, checklist]);

  const copy = () => {
    try {
      void navigator.clipboard.writeText(text).then(() => setToast('Copied'), () => setToast('Copy failed'));
    } catch {
      setToast('Copy failed');
    }
  };
  const confirm = () => {
    setBusy(true); setError(null);
    provider.createDecision({ plan, ctx, notes: notes.trim() || null, announcementText: text }).then(
      onConfirmed,
      (e: unknown) => { setBusy(false); setError(e instanceof Error ? e.message : String(e)); },
    );
  };

  return (
    <section ref={ref} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby="decision-h"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      className="flex flex-col gap-4 rounded-lg border border-verified bg-panel p-4 outline-none focus-visible:outline-2 focus-visible:outline-verified">
      <div className="flex items-center justify-between">
        <h2 id="decision-h" className="text-lg font-semibold text-text">Confirm: {plan.name} · {rmText(plan.totalCostRm)}</h2>
        <button type="button" onClick={onClose} className={`${btn} border-border bg-panel-2 text-text`}>Close</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <section aria-label="Checklist preview">
          <h3 className="mb-2 text-sm font-semibold text-text">Checklist</h3>
          {!checklist ? <p role="status" className="text-sm text-text-2">{fc.status === 'error' ? `Unavailable: ${fc.error}` : 'Loading checklist…'}</p> : (
            <div className="flex flex-col gap-3">
              {groups.map((g) => (
                <div key={g.team}>
                  <h4 className="text-sm font-medium text-text-2">{TEAM_LABEL[g.team]}</h4>
                  <ul className="flex flex-col gap-1 text-sm text-text">
                    {g.items.map((it, i) => (
                      <li key={i}>{it.text}{it.dueMin !== null && <span className="tabular text-text-2"> · due {clock12(it.dueMin)}</span>}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
        <section aria-label="Announcement" className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text">Announcement draft</h3>
          {draft === null ? <p role="status" className="text-sm text-text-2">Drafting announcement…</p>
            : typing ? <p className="whitespace-pre-wrap rounded-md border border-border bg-bg p-2 text-sm text-text"><TypedText text={draft} cps={120} onDone={() => setTyping(false)} /></p>
              : (
                <>
                  <label htmlFor="ann-text" className="sr-only">Announcement text</label>
                  <textarea id="ann-text" rows={8} value={text} onChange={(e) => setText(e.target.value)}
                    className="rounded-md border border-border bg-bg p-2 text-sm text-text focus-visible:outline-2 focus-visible:outline-verified" />
                  <div><button type="button" onClick={copy} className={`${btn} border-border bg-panel-2 text-text`}>Copy</button></div>
                </>
              )}
          <label htmlFor="dec-notes" className="text-sm text-text-2">Notes</label>
          <textarea id="dec-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            className="rounded-md border border-border bg-bg p-2 text-sm text-text focus-visible:outline-2 focus-visible:outline-verified" />
        </section>
      </div>
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
      <div>
        <button type="button" disabled={busy || draft === null} onClick={confirm}
          className={`${btn} border-accent bg-accent text-white disabled:opacity-50`}>Confirm decision</button>
      </div>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </section>
  );
}
