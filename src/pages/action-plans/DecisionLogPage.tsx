import { useCallback, useEffect, useState } from 'react';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useSubscription } from '../../hooks/useSubscription.ts';
import { clock12, dateText, durationText, rmText } from '../../lib/format.ts';
import { mytDate, mytMinutes } from '../../lib/dates.ts';
import type { Decision } from '../../providers/types.ts';
import { DecisionDetail } from './DecisionDetail.tsx';

const STATUSES: Decision['status'][] = ['planned', 'done', 'cancelled'];
const STATUS_LABEL: Record<Decision['status'], string> = { planned: 'Planned', done: 'Done', cancelled: 'Cancelled' };
const field = 'rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-verified';

function NotesCell({ d, onSave }: { d: Decision; onSave: (notes: string | null) => void }) {
  const [v, setV] = useState(d.notes ?? '');
  useEffect(() => setV(d.notes ?? ''), [d.notes]);
  return (
    <input aria-label={`Notes for ${d.planName}`} className={`${field} w-56`} value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== (d.notes ?? '')) onSave(v.trim() === '' ? null : v); }} />
  );
}

export default function DecisionLogPage() {
  const provider = useProvider();
  const [rows, setRows] = useState<Decision[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    provider.listDecisions().then((r) => {
      setRows(r);
      const ids = [...new Set(r.flatMap((d) => (d.disruptionId ? [d.disruptionId] : [])))];
      void Promise.all(ids.map((i) => provider.getDisruption(i).catch(() => null))).then((items) => {
        const m: Record<string, string> = {};
        items.forEach((it) => { if (it) m[it.id] = it.title; });
        setTitles(m);
      });
    }, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [provider]);
  useEffect(load, [load]);
  useSubscription('decisions', load);
  useSubscription('checklist_items', load);

  const update = (id: string, patch: { status?: Decision['status']; notes?: string | null }) => {
    setError(null);
    provider.updateDecision(id, patch).then(load, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  const heads = ['Date and context', 'Plan', 'Status', 'Notes', 'Total cost', 'Predicted peak APU wait', 'Decided by', 'Decided at', 'Details'];
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto [color-scheme:dark] pr-1">
      <h1 className="text-xl font-semibold text-text">Decision Log</h1>
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
      {rows === null ? <p role="status" className="text-text-2">Loading decisions…</p>
        : rows.length === 0 ? <p className="text-text-2">No decisions yet. Choose a plan on the Action Plans page.</p> : (
          <div className="overflow-x-auto rounded-lg border border-border bg-panel">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-2">
                  {heads.map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const w = d.predicted.peakApuWaitMin;
                  return (
                    <tr key={d.id} className={`border-b border-border last:border-0 ${open === d.id ? 'bg-panel-2' : ''}`}>
                      <td className="px-3 py-2 text-text">{dateText(d.contextDate)}{d.disruptionId ? ` · ${titles[d.disruptionId] ?? d.disruptionId}` : ''}</td>
                      <td className="px-3 py-2 text-text">{d.planName}</td>
                      <td className="px-3 py-2">
                        <select aria-label={`Status for ${d.planName}`} className={field} value={d.status}
                          onChange={(e) => update(d.id, { status: e.target.value as Decision['status'] })}>
                          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2"><NotesCell d={d} onSave={(notes) => update(d.id, { notes })} /></td>
                      <td className="tabular px-3 py-2 text-text">{rmText(d.totalCostRm)}</td>
                      <td className="tabular px-3 py-2 text-text">{w === null ? 'No service' : durationText(w)}</td>
                      <td className="px-3 py-2 text-text">{d.decidedBy}</td>
                      <td className="tabular px-3 py-2 text-text">{dateText(mytDate(d.decidedAt))}, {clock12(mytMinutes(d.decidedAt))}</td>
                      <td className="px-3 py-2">
                        <button type="button" aria-expanded={open === d.id} onClick={() => setOpen(open === d.id ? null : d.id)}
                          className="rounded-md border border-border bg-panel-2 px-3 py-1 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verified">
                          {open === d.id ? 'Hide' : 'Open'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      {open && <DecisionDetail key={open} id={open} />}
    </div>
  );
}
