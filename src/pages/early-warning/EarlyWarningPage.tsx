import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { DisruptionType, RiskLevel } from '@engine/index.ts';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useSubscription } from '../../hooks/useSubscription.ts';
import { useContextStore } from '../../store/context.ts';
import { Toast } from '../../components/Toast.tsx';
import { addDays, mytDate } from '../../lib/dates.ts';
import type { DisruptionInput, EarlyWarningItem, OverridePatch, ScanRun, Today } from '../../providers/types.ts';
import { DisruptionForm } from './DisruptionForm.tsx';
import { FilterBar } from './FilterBar.tsx';
import { OverrideForm } from './OverrideForm.tsx';
import { ScanStatus } from './ScanStatus.tsx';
import { WarningCard } from './WarningCard.tsx';
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
    <div className="h-full min-h-0 space-y-3 overflow-y-auto pr-2">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Early Warning</h1>
        <div className="flex items-center gap-4">
          <ScanStatus run={scan} />
          <button type="button" onClick={() => void runScan()} disabled={scanning} aria-busy={scanning}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-panel-2 px-4 py-1.5 text-sm font-medium disabled:opacity-60">
            {scanning && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-3 border-t-transparent" />}
            {scanning ? 'Scanning…' : 'Scan now'}
          </button>
          <button type="button" onClick={() => setForm({ kind: 'add' })} disabled={!today}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60">Add disruption</button>
        </div>
      </div>
      <FilterBar types={types} risks={risks} onTypes={setTypes} onRisks={setRisks} />
      {error && <p role="alert" className="rounded-md border border-red/60 px-3 py-2 text-sm text-red">Something went wrong: {error}</p>}
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
        <p className="text-text-2">{items.length === 0 ? 'No upcoming disruptions in the next 180 days.' : 'No disruptions match these filters.'}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {visible.map((i) => <WarningCard key={i.id} item={i} actions={actions} />)}
        </ul>
      )}
      <details className="rounded-lg border border-border bg-panel p-3">
        <summary className="cursor-pointer text-sm font-medium">Past disruptions ({past.length})</summary>
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {past.map((i) => <WarningCard key={i.id} item={i} actions={actions} past />)}
        </ul>
        {past.length === 0 && <p className="mt-2 text-sm text-text-2">No past disruptions.</p>}
      </details>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  );
}
