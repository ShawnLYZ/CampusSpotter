import { useEffect, useId, useRef, useState } from 'react';
import { fromLocalInput, toLocalInput } from '../../lib/dates.ts';
import type { EarlyWarningItem, OverridePatch } from '../../providers/types.ts';

export const FIELD = 'field mt-1 w-full';

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
      className="card space-y-4 border-accent/50 p-5 shadow-[var(--shadow-pop)]" aria-label={`Override ${item.title}`}>
      <h3 className="text-base font-medium">Override: {item.title}</h3>
      <div className="grid grid-cols-3 gap-3">
        <label className="field-label">Start (Malaysia time)
          <input ref={first} type="datetime-local" className={FIELD} value={start} onChange={(x) => setStart(x.target.value)} aria-describedby={msg ? errId : undefined} />
        </label>
        <label className="field-label">End (Malaysia time)
          <input type="datetime-local" className={FIELD} value={end} onChange={(x) => setEnd(x.target.value)} aria-describedby={msg ? errId : undefined} />
        </label>
        <label className="field-label">Expected attendance
          <input type="number" min={0} step={1} className={FIELD} value={att} onChange={(x) => setAtt(x.target.value)} aria-describedby={msg ? errId : undefined} />
        </label>
      </div>
      {msg && <p id={errId} role="alert" className="text-sm text-red-ink">{msg}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || timeBad || attBad} className="btn btn-primary">Save override</button>
        <button type="button" onClick={onCancel} className="btn btn-quiet">Cancel</button>
      </div>
    </form>
  );
}
