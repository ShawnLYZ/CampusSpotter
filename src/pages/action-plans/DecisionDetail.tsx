import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useForecast } from '../../hooks/useForecast.ts';
import { useSubscription } from '../../hooks/useSubscription.ts';
import { useTimeStore } from '../../store/time.ts';
import { normalise } from '../../store/context.ts';
import { clock12 } from '../../lib/format.ts';
import { mytMinutes } from '../../lib/dates.ts';
import { SceneSlot } from '../../scene/SceneSlot.tsx';
import { Timeline } from '../../components/Timeline.tsx';
import { Toast } from '../../components/Toast.tsx';
import type { DecisionBundle } from '../../providers/types.ts';
import type { Forecast } from '@engine/index.ts';
import { SmallMultiples } from '../scenario-lab/SmallMultiples.tsx';
import { groupByTeam, TEAM_LABEL } from './planUtils.ts';

const NO_LEVERS: never[] = [];
type Loaded = DecisionBundle & { forecast: Forecast | null };
const btn = 'rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm font-medium text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verified';

export function DecisionDetail({ id }: { id: string }) {
  const provider = useProvider();
  const step = useTimeStore((s) => s.step);
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    provider.getDecision(id).then(
      (d) => { setData(d); },
      () => setToast('Could not load the decision'),
    );
  }, [provider, id]);
  useEffect(load, [load]);
  useSubscription('checklist_items', load);
  useEffect(() => {
    if (data) setText(data.announcement.editedText ?? data.announcement.draft);
  }, [data?.announcement.id, data?.announcement.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(
    () => normalise({ date: data?.decision.contextDate ?? '', disruptionId: data?.decision.disruptionId ?? undefined }),
    [data?.decision.contextDate, data?.decision.disruptionId],
  );
  const fc = useForecast(ctx, NO_LEVERS);

  if (data === undefined) return <p role="status" className="text-text-2">Loading decision…</p>;
  if (data === null) return <p role="alert" className="text-red">Decision not found.</p>;

  const groups = groupByTeam(data.checklist);
  const saved = data.forecast;
  const saveText = () => {
    provider.updateAnnouncement(data.announcement.id, text).then(
      () => { setToast('Announcement saved'); load(); },
      () => setToast('Could not save the announcement'),
    );
  };
  const toggle = (itemId: string, done: boolean) => {
    provider.setChecklistItemDone(itemId, done).then(load, () => setToast('Could not update the checklist'));
  };

  return (
    <section aria-label={`Details for ${data.decision.planName}`} className="flex flex-col gap-4 rounded-lg border border-border bg-panel p-4">
      <h2 className="text-lg font-semibold text-text">{data.decision.planName}</h2>
      <div className="grid grid-cols-2 gap-4">
        <section aria-label="Checklist">
          <h3 className="mb-2 text-sm font-semibold text-text">Checklist</h3>
          <div className="flex flex-col gap-3">
            {groups.map((g) => (
              <fieldset key={g.team}>
                <legend className="text-sm font-medium text-text-2">{TEAM_LABEL[g.team]}</legend>
                <ul className="flex flex-col gap-1 text-sm text-text">
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <label className="flex items-start gap-2">
                        <input type="checkbox" checked={it.done} onChange={(e) => toggle(it.id, e.target.checked)}
                          className="mt-0.5 h-4 w-4 focus-visible:outline-2 focus-visible:outline-verified" />
                        <span>{it.text}{it.dueAt && <span className="tabular text-text-2"> · due {clock12(mytMinutes(it.dueAt))}</span>}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}
          </div>
        </section>
        <section aria-label="Announcement" className="flex flex-col gap-2">
          <label htmlFor="detail-ann" className="text-sm font-semibold text-text">Announcement</label>
          <textarea id="detail-ann" rows={8} value={text} onChange={(e) => setText(e.target.value)}
            className="rounded-md border border-border bg-bg p-2 text-sm text-text focus-visible:outline-2 focus-visible:outline-verified" />
          <div><button type="button" className={btn} onClick={saveText}>Save announcement</button></div>
        </section>
      </div>
      <section aria-label="Saved scenario" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text">Saved scenario</h3>
        {saved && fc.status === 'ready' && fc.noAction && fc.bundle ? (
          <>
            <div className="h-[200px]">
              <SceneSlot mode="split" forecasts={[fc.noAction, saved]} captions={['No action', 'Saved plan']} step={step}
                weatherMm={fc.bundle.weather?.precipitationMm.map((p) => p?.value ?? null)} />
            </div>
            <Timeline nowStep={null} />
            <SmallMultiples noAction={fc.noAction} withPlan={saved} thresholds={fc.bundle.settings.thresholds} step={step} />
          </>
        ) : (
          <p role="status" className="text-sm text-text-2">
            {!saved ? 'No saved forecast for this decision.' : fc.status === 'error' ? `Forecast unavailable: ${fc.error}` : 'Loading forecast…'}
          </p>
        )}
      </section>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </section>
  );
}
