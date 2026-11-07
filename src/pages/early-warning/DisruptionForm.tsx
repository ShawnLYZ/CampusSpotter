import { useEffect, useId, useRef, useState } from 'react';
import type { DisruptionKind, DisruptionType } from '@engine/index.ts';
import { fromLocalInput, toLocalInput } from '../../lib/dates.ts';
import type { DisruptionInput, EarlyWarningItem } from '../../providers/types.ts';
import { TYPE_CHIPS } from './FilterBar.tsx';
import { FIELD } from './OverrideForm.tsx';

const KINDS: DisruptionKind[] = ['concert', 'sports', 'intake', 'holiday', 'break', 'friday_prayer', 'heavy_rain', 'other'];
const kindLabel = (k: string) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function DisruptionForm({ item, defaultDate, onSubmit, onCancel }: {
  item?: EarlyWarningItem; defaultDate: string; onSubmit: (input: DisruptionInput) => Promise<void>; onCancel: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState(item?.title ?? '');
  const [type, setType] = useState<DisruptionType>(item?.type ?? 'manual');
  const [kind, setKind] = useState<DisruptionKind>(item?.kind ?? 'other');
  const [venue, setVenue] = useState(item?.venue ?? '');
  const [start, setStart] = useState(item ? toLocalInput(item.startAt) : `${defaultDate}T08:00`);
  const [end, setEnd] = useState(item ? toLocalInput(item.endAt) : `${defaultDate}T18:00`);
  const [att, setAtt] = useState(item?.expectedAttendance != null ? String(item.expectedAttendance) : '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);

  const s = fromLocalInput(start);
  const e = fromLocalInput(end);
  const attN = att.trim() === '' ? null : Number(att);
  const titleErr = title.trim() === '' ? 'Title is required.' : null;
  const timeErr = !s || !e ? 'Enter a start and end time.' : Date.parse(e) <= Date.parse(s) ? 'End must be after start.' : null;
  const attErr = attN !== null && (!Number.isInteger(attN) || attN < 0) ? 'Attendance must be a whole number, 0 or more.' : null;
  const titleId = `${id}-title`;
  const timeId = `${id}-time`;
  const attId = `${id}-att`;
  const errId = `${id}-err`;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    setError(null);
    if (titleErr || timeErr || attErr || !s || !e) return;
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(), type, kind, venue: venue.trim() || null, startAt: s, endAt: e,
        expectedAttendance: attN, notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={(ev) => void submit(ev)} noValidate onKeyDown={(ev) => { if (ev.key === 'Escape') onCancel(); }}
      className="space-y-3 rounded-lg border border-verified/60 bg-panel-2 p-4" aria-label={item ? `Edit ${item.title}` : 'Add disruption'}>
      <h3 className="font-semibold">{item ? 'Edit disruption' : 'Add disruption'}</h3>
      <div className="grid grid-cols-4 gap-3">
        <label className="col-span-2 text-sm">Title
          <input ref={first} className={FIELD} value={title} onChange={(x) => setTitle(x.target.value)} required aria-invalid={submitted && !!titleErr}
            aria-describedby={submitted && titleErr ? titleId : undefined} />
          {submitted && titleErr && <span id={titleId} className="mt-1 block text-red">{titleErr}</span>}
        </label>
        <label className="text-sm">Type
          <select className={FIELD} value={type} onChange={(x) => setType(x.target.value as DisruptionType)}>
            {TYPE_CHIPS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Kind
          <select className={FIELD} value={kind} onChange={(x) => setKind(x.target.value as DisruptionKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </select>
        </label>
        <label className="text-sm">Venue
          <input className={FIELD} value={venue} onChange={(x) => setVenue(x.target.value)} />
        </label>
        <label className="text-sm">Start (Malaysia time)
          <input type="datetime-local" className={FIELD} value={start} onChange={(x) => setStart(x.target.value)} aria-invalid={submitted && !!timeErr}
            aria-describedby={submitted && timeErr ? timeId : undefined} />
        </label>
        <label className="text-sm">End (Malaysia time)
          <input type="datetime-local" className={FIELD} value={end} onChange={(x) => setEnd(x.target.value)} aria-invalid={submitted && !!timeErr}
            aria-describedby={submitted && timeErr ? timeId : undefined} />
          {submitted && timeErr && <span id={timeId} className="mt-1 block text-red">{timeErr}</span>}
        </label>
        <label className="text-sm">Expected attendance
          <input type="number" min={0} step={1} className={FIELD} value={att} onChange={(x) => setAtt(x.target.value)} aria-invalid={submitted && !!attErr}
            aria-describedby={submitted && attErr ? attId : undefined} />
          {submitted && attErr && <span id={attId} className="mt-1 block text-red">{attErr}</span>}
        </label>
        <label className="col-span-4 text-sm">Notes
          <textarea className={FIELD} rows={2} value={notes} onChange={(x) => setNotes(x.target.value)} />
        </label>
      </div>
      {error && <p id={errId} role="alert" className="text-sm text-red">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">{item ? 'Save changes' : 'Add disruption'}</button>
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-4 py-1.5 text-sm">Cancel</button>
      </div>
    </form>
  );
}
