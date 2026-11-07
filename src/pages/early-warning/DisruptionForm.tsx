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
      className="card space-y-4 border-accent/50 p-5 shadow-[var(--shadow-pop)]" aria-label={item ? `Edit ${item.title}` : 'Add disruption'}>
      <h3 className="text-base font-medium">{item ? 'Edit disruption' : 'Add disruption'}</h3>
      <div className="grid grid-cols-4 gap-3">
        <label className="field-label col-span-2">Title
          <input ref={first} className={FIELD} value={title} onChange={(x) => setTitle(x.target.value)} required aria-invalid={submitted && !!titleErr}
            aria-describedby={submitted && titleErr ? titleId : undefined} />
          {submitted && titleErr && <span id={titleId} className="mt-1 block text-red-ink">{titleErr}</span>}
        </label>
        <label className="field-label">Type
          <select className={FIELD} value={type} onChange={(x) => setType(x.target.value as DisruptionType)}>
            {TYPE_CHIPS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="field-label">Kind
          <select className={FIELD} value={kind} onChange={(x) => setKind(x.target.value as DisruptionKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </select>
        </label>
        <label className="field-label">Venue
          <input className={FIELD} value={venue} onChange={(x) => setVenue(x.target.value)} />
        </label>
        <label className="field-label">Start (Malaysia time)
          <input type="datetime-local" className={FIELD} value={start} onChange={(x) => setStart(x.target.value)} aria-invalid={submitted && !!timeErr}
            aria-describedby={submitted && timeErr ? timeId : undefined} />
        </label>
        <label className="field-label">End (Malaysia time)
          <input type="datetime-local" className={FIELD} value={end} onChange={(x) => setEnd(x.target.value)} aria-invalid={submitted && !!timeErr}
            aria-describedby={submitted && timeErr ? timeId : undefined} />
          {submitted && timeErr && <span id={timeId} className="mt-1 block text-red-ink">{timeErr}</span>}
        </label>
        <label className="field-label">Expected attendance
          <input type="number" min={0} step={1} className={FIELD} value={att} onChange={(x) => setAtt(x.target.value)} aria-invalid={submitted && !!attErr}
            aria-describedby={submitted && attErr ? attId : undefined} />
          {submitted && attErr && <span id={attId} className="mt-1 block text-red-ink">{attErr}</span>}
        </label>
        <label className="field-label col-span-4">Notes
          <textarea className={FIELD} rows={2} value={notes} onChange={(x) => setNotes(x.target.value)} />
        </label>
      </div>
      {error && <p id={errId} role="alert" className="text-sm text-red-ink">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary">{item ? 'Save changes' : 'Add disruption'}</button>
        <button type="button" onClick={onCancel} className="btn btn-quiet">Cancel</button>
      </div>
    </form>
  );
}
