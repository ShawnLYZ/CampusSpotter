import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { DisruptionType, RiskLevel } from '@engine/index.ts';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useSubscription } from '../../hooks/useSubscription.ts';
import { useContextStore } from '../../store/context.ts';
import { Toast } from '../../components/Toast.tsx';
import { addDays, mytDate } from '../../lib/dates.ts';
import { withoutEndPeriod } from '../../lib/format.ts';
import type { DisruptionInput, EarlyWarningItem, OverridePatch, ScanRun, Today } from '../../providers/types.ts';
import { DisruptionForm } from './DisruptionForm.tsx';
import { FilterBar } from './FilterBar.tsx';
import { OverrideForm } from './OverrideForm.tsx';
import { ScanStatus } from './ScanStatus.tsx';
import { WarningCard } from './WarningCard.tsx';
import { CalendarClock, Plus, RefreshCw, Siren } from 'lucide-react';
import { PageIntro } from '../../components/PageIntro.tsx';
import type { CardActions } from './WarningCard.tsx';

type FormState = { kind: 'add' } | { kind: 'edit'; item: EarlyWarningItem } | null;

export default function EarlyWarningPage() {
  const provider = useProvider();
  const navigate = useNavigate();
  const setCtx = useContextStore((s) => s.setCtx);

  const [today, setToday] = useState<Today | null>(null);
  const [items, setItems] = useState<EarlyWarningItem[]>([]);
  const [past, setPast] = useState<EarlyWarningItem[]>([]);
  const [scan, setScan] = useState<ScanRun | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [types, setTypes] = useState<Set<DisruptionType>>(new Set());
  const [risks, setRisks] = useState<Set<RiskLevel>>(new Set());
  const [form, setForm] = useState<FormState>(null);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const reqId = useRef(0);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let cancelled = false;
    provider.getToday().then((t) => { if (!cancelled) setToday(t); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [provider]);

  const load = useCallback(() => {
    if (!today) return;
    const id = ++reqId.current;
    Promise.all([
      provider.listDisruptions({ from: today.date, to: addDays(today.date, 180) }),
      provider.listDisruptions({ from: addDays(today.date, -365), to: today.date, includePast: true }),
      provider.getLatestScan(),
    ]).then(([upcoming, withPast, latest]) => {
      if (id !== reqId.current) return;
      setItems(upcoming);
      setPast(withPast.filter((i) => i.isPast).sort((a, b) => b.startAt.localeCompare(a.startAt)));
      setScan(latest);
      setError(null);
      setLoaded(true);
    }).catch((e: unknown) => {
      if (id !== reqId.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setLoaded(true);
    });
  }, [provider, today]);
  useEffect(load, [load]);
  useSubscription('disruptions', load);
  useSubscription('job_runs', load);

  const guard = async (fn: () => Promise<unknown>) => {
    try { await fn(); setError(null); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const run = await provider.triggerScan();
      setScan(run);
      setToast(`Scan finished: ${run.itemsFound} items found, ${run.itemsChanged} changed`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setScanning(false); }
  };

  const open = (path: string) => (i: EarlyWarningItem) => {
    setCtx({ date: mytDate(i.startAt), disruptionId: i.id });
    void navigate(path);
  };
  const actions: CardActions = {
    onScenario: open('/scenario-lab'),
    onPlans: open('/action-plans'),
    onEdit: (i) => setForm({ kind: 'edit', item: i }),
    onDismiss: (i) => void guard(() => provider.dismissDisruption(i.id)),
    onDelete: (i) => void guard(() => provider.deleteDisruption(i.id)),
  };

  const visible = items.filter((i) => (types.size === 0 || types.has(i.type)) && (risks.size === 0 || (i.riskLevel !== null && risks.has(i.riskLevel))));
  const defaultDate = today ? addDays(today.date, 1) : '';

  const submitForm = async (input: DisruptionInput) => {
    if (form?.kind === 'edit') await provider.updateDisruption(form.item.id, input);
    else await provider.createDisruption(input);
    setForm(null);
    load();
  };
  const submitOverride = async (patch: OverridePatch) => {
    if (form?.kind !== 'edit') return;
    await provider.overrideDisruption(form.item.id, patch);
    setForm(null);
    load();
  };

  return (
    <div className="h-full min-h-0 space-y-5 overflow-y-auto pr-2">
      <PageIntro id="early-warning" Icon={Siren} title="Early Warning"
        summary="Days in the next six months that could overload the shuttle or campus, most urgent first."
        steps={['Find a day with a high or critical risk', 'Read why, and what peaks if nothing is done', 'Open it in Scenario Lab, or generate plans']}
        actions={<>
          <ScanStatus run={scan} />
          <button type="button" onClick={() => void runScan()} disabled={scanning} aria-busy={scanning} className="btn">
            <RefreshCw aria-hidden="true" className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Scanning…' : 'Scan for events'}
          </button>
          <button type="button" onClick={() => setForm({ kind: 'add' })} disabled={!today} className="btn">
            <Plus aria-hidden="true" /> Add disruption
          </button>
        </>} />
      <FilterBar types={types} risks={risks} onTypes={setTypes} onRisks={setRisks} />
      {error && <p role="alert" className="rounded-xl border border-red/60 bg-red/10 px-4 py-3 text-sm text-red-ink">Something went wrong: {withoutEndPeriod(error)}. Try again, or reload the page.</p>}
      {form?.kind === 'add' && <DisruptionForm defaultDate={defaultDate} onSubmit={submitForm} onCancel={() => setForm(null)} />}
      {form?.kind === 'edit' && form.item.origin === 'manual' && (
        <DisruptionForm key={form.item.id} item={form.item} defaultDate={defaultDate} onSubmit={submitForm} onCancel={() => setForm(null)} />
      )}
      {form?.kind === 'edit' && form.item.origin === 'scan' && (
        <OverrideForm key={form.item.id} item={form.item} onSubmit={submitOverride} onCancel={() => setForm(null)} />
      )}
      {!loaded && !error ? (
        <p role="status" className="text-text-2">Loading disruptions…</p>
      ) : visible.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
          <CalendarClock aria-hidden="true" className="h-8 w-8 text-text-3" />
          <p className="font-medium">{items.length === 0 ? 'No upcoming disruptions in the next 180 days' : 'No disruptions match these filters'}</p>
          <p className="text-sm text-text-2">{items.length === 0 ? 'Run a scan, or add one you know about, such as road works or an open day.' : 'Turn off a filter above to see more.'}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4">
          {visible.map((i, n) => <WarningCard key={i.id} item={i} actions={actions} lead={n === 0 && (i.riskLevel === 'high' || i.riskLevel === 'critical')} />)}
        </ul>
      )}
      <details className="card p-4">
        <summary className="text-sm font-medium text-text-2 hover:text-text">Past disruptions ({past.length})</summary>
        <ul className="mt-4 grid grid-cols-2 gap-4">
          {past.map((i) => <WarningCard key={i.id} item={i} actions={actions} past />)}
        </ul>
        {past.length === 0 && <p className="mt-2 text-sm text-text-2">No past disruptions.</p>}
      </details>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  );
}
