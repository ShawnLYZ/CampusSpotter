import { useCallback, useEffect, useState } from 'react';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useSubscription } from '../../hooks/useSubscription.ts';
import { clock12, dateText, durationText, rmText } from '../../lib/format.ts';
import { mytDate, mytMinutes } from '../../lib/dates.ts';
import type { Decision } from '../../providers/types.ts';
import { DecisionDetail } from './DecisionDetail.tsx';
import { Link } from 'react-router';
import { BookOpen, ClipboardCheck } from 'lucide-react';
import { PageIntro } from '../../components/PageIntro.tsx';

const STATUSES: Decision['status'][] = ['planned', 'done', 'cancelled'];
const STATUS_LABEL: Record<Decision['status'], string> = { planned: 'Planned', done: 'Done', cancelled: 'Cancelled' };
const field = 'field !py-1 !px-2';

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
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto pr-1">
      <PageIntro id="decision-log" Icon={BookOpen} title="Decision Log"
        summary="Every plan that was chosen, with its predicted effect, cost and progress. Open one to tick off checklist items." />
      {error && <p role="alert" className="rounded-xl border border-red/60 bg-red/10 px-4 py-3 text-sm text-red-ink">{error}</p>}
      {rows === null ? <p role="status" className="text-text-2">Loading decisions…</p>
        : rows.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
            <ClipboardCheck aria-hidden="true" className="h-8 w-8 text-text-3" />
            <p className="font-medium">No decisions yet</p>
            <p className="text-sm text-text-2">Choose a plan on Action Plans and confirm it. It will appear here.</p>
            <Link to="/action-plans" className="btn btn-primary mt-2">Go to Action Plans</Link>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-panel-2/60 text-left text-text-2">
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
                          className={`btn btn-sm ${open === d.id ? 'btn-primary' : ''}`}>
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
