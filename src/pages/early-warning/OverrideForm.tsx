import { useEffect, useId, useRef, useState } from 'react';
import { fromLocalInput, toLocalInput } from '../../lib/dates.ts';
import type { EarlyWarningItem, OverridePatch } from '../../providers/types.ts';

export const FIELD = 'mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text';

export function OverrideForm({ item, onSubmit, onCancel }: {
  item: EarlyWarningItem; onSubmit: (patch: OverridePatch) => Promise<void>; onCancel: () => void;
}) {
  const id = useId();
  const cur = item.override;
  const [start, setStart] = useState(toLocalInput(cur?.startAt ?? item.startAt));
  const [end, setEnd] = useState(toLocalInput(cur?.endAt ?? item.endAt));
  const [att, setAtt] = useState(String(cur?.expectedAttendance ?? item.expectedAttendance ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);

  const s = fromLocalInput(start);
  const e = fromLocalInput(end);
  const attN = att.trim() === '' ? null : Number(att);
  const attBad = attN !== null && (!Number.isFinite(attN) || attN < 0 || !Number.isInteger(attN));
  const timeBad = !s || !e || Date.parse(e) <= Date.parse(s);
  const errId = `${id}-err`;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (timeBad || attBad || !s || !e) return;
    setBusy(true);
    try {
      const patch: OverridePatch = { startAt: s, endAt: e };
      if (attN !== null) patch.expectedAttendance = attN;
      await onSubmit(patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const msg = error ?? (timeBad ? 'End must be after start.' : attBad ? 'Attendance must be a whole number, 0 or more.' : null);
  return (
    <form onSubmit={(ev) => void submit(ev)} onKeyDown={(ev) => { if (ev.key === 'Escape') onCancel(); }}
      className="space-y-3 rounded-lg border border-verified/60 bg-panel-2 p-4" aria-label={`Override ${item.title}`}>
      <h3 className="font-semibold">Override: {item.title}</h3>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-sm">Start (Malaysia time)
          <input ref={first} type="datetime-local" className={FIELD} value={start} onChange={(x) => setStart(x.target.value)} aria-describedby={msg ? errId : undefined} />
        </label>
        <label className="text-sm">End (Malaysia time)
          <input type="datetime-local" className={FIELD} value={end} onChange={(x) => setEnd(x.target.value)} aria-describedby={msg ? errId : undefined} />
        </label>
        <label className="text-sm">Expected attendance
          <input type="number" min={0} step={1} className={FIELD} value={att} onChange={(x) => setAtt(x.target.value)} aria-describedby={msg ? errId : undefined} />
        </label>
      </div>
      {msg && <p id={errId} role="alert" className="text-sm text-red">{msg}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || timeBad || attBad} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">Save override</button>
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-4 py-1.5 text-sm">Cancel</button>
      </div>
    </form>
  );
}
