import { useEffect, useMemo, useRef, useState } from 'react';
import { worstPressureByStep } from '../../lib/worstPressure.ts';
import { useNavigate } from 'react-router';
import { stepOf } from '@engine/index.ts';
import { FRIDAY_PRAYER_PLAN } from '@plans/fridayPlan.ts';
import { addDays } from '../../lib/dates.ts';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useContextStore } from '../../store/context.ts';
import { useLeverStore } from '../../store/levers.ts';
import { useTimeStore } from '../../store/time.ts';
import { useForecast } from '../../hooks/useForecast.ts';
import { SceneSlot } from '../../scene/SceneSlot.tsx';
import { Timeline } from '../../components/Timeline.tsx';
import { Toast } from '../../components/Toast.tsx';
import type { Today } from '../../providers/types.ts';
import { ContextPicker } from './ContextPicker.tsx';
import { LeverPanel } from './LeverPanel.tsx';
import { AskBox } from './AskBox.tsx';
import { EstimatesPanel } from './EstimatesPanel.tsx';
import { SmallMultiples } from './SmallMultiples.tsx';
import { SummaryRow } from './SummaryRow.tsx';
import { FlaskConical, ListChecks, MoonStar, RotateCcw } from 'lucide-react';
import { PageIntro } from '../../components/PageIntro.tsx';
import { Legend } from '../../components/Legend.tsx';


/** The next Friday on or after `date` (calendar arithmetic on Malaysia dates). */
export function nextFriday(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, (5 - dow + 7) % 7);
}

export default function ScenarioLabPage() {
  const provider = useProvider();
  const navigate = useNavigate();
  const ctx = useContextStore((s) => s.ctx);
  const setCtx = useContextStore((s) => s.setCtx);
  const levers = useLeverStore((s) => s.levers);
  const highlighted = useLeverStore((s) => s.highlighted);
  const { setLevers, upsert, remove, reset } = useLeverStore.getState();
  const step = useTimeStore((s) => s.step);
  const fc = useForecast(ctx, levers, { refreshEstimates: true });

  // Keep the lever panel mounted (and its highlight timer running) while a new day's bundle loads.
  const lastBundle = useRef(fc.bundle);
  if (fc.bundle) lastBundle.current = fc.bundle;
  const panelBundle = fc.bundle ?? lastBundle.current;

  const [today, setToday] = useState<Today | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void provider.getToday().then((t) => { if (!cancelled) setToday(t); });
    return () => { cancelled = true; };
  }, [provider]);

  const nowStep = today !== null && ctx.date === today.date ? Math.min(75, Math.max(0, stepOf(today.nowMin))) : null;

  const fridayScenario = () => {
    if (!today) return;
    setCtx({ date: nextFriday(today.date) });
    const plan = structuredClone(FRIDAY_PRAYER_PLAN);
    setLevers(plan, plan.map((l) => l.kind));
  };
  const save = () => {
    void provider.saveForecast(ctx, levers).then(
      () => setToast('Forecast saved'),
      () => setToast('Could not save the forecast'),
    );
  };

  const ready = fc.status === 'ready' && fc.bundle && fc.noAction && fc.withPlan;
  const strip = useMemo(() => (fc.withPlan ? worstPressureByStep(fc.withPlan) : undefined), [fc.withPlan]);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
      <PageIntro id="scenario-lab" Icon={FlaskConical} compact title="Scenario Lab"
        summary="Try actions on any day and compare “No action” with “With plan” side by side."
        steps={['Pick a day or disruption', 'Tick actions on the left, or ask Gemini', 'Compare the two futures and the summary']}
        actions={<>
          <button type="button" className="btn btn-quiet" onClick={reset} disabled={levers.length === 0}><RotateCcw aria-hidden="true" /> Reset to no action</button>
          <button type="button" className="btn" onClick={fridayScenario} disabled={!today}><MoonStar aria-hidden="true" /> Friday prayer scenario</button>
          <button type="button" className="btn" onClick={save}>Save forecast</button>
          <button type="button" className="btn btn-primary" onClick={() => void navigate('/action-plans')}><ListChecks aria-hidden="true" /> Generate plans</button>
        </>} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ContextPicker today={today} />
        <Legend />
      </div>

      <div className="grid min-h-0 grid-cols-[360px_minmax(0,1fr)_340px] gap-4">
        <aside aria-label="Levers" className="min-h-0 overflow-y-auto pr-1">
          {panelBundle
            ? <LeverPanel levers={levers} highlighted={highlighted} bundle={panelBundle} onUpsert={upsert} onRemove={remove} />
            : <p role="status" className="text-text-2">Loading levers…</p>}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto pr-1">
          {ready ? (
            <>
              <div className="h-[280px] shrink-0">
                <SceneSlot mode="split" forecasts={[fc.noAction!, fc.withPlan!]} captions={['No action', 'With plan']} step={step}
                  weatherMm={fc.bundle!.weather?.precipitationMm.map((p) => p?.value ?? null)} />
              </div>
              <Timeline nowStep={nowStep} pressures={strip} />
              <SmallMultiples noAction={fc.noAction!} withPlan={fc.withPlan!} thresholds={fc.bundle!.settings.thresholds} step={step} bundle={fc.bundle} />
              <div className="card p-4">
                <SummaryRow noAction={fc.noAction!.summary} withPlan={fc.withPlan!.summary} forecasts={[fc.noAction!, fc.withPlan!]} bundle={fc.bundle} />
              </div>
            </>
          ) : (
            <>
              <p role="status" className="p-6 text-text-2">{fc.status === 'error' ? `Forecast unavailable: ${fc.error}` : 'Loading forecast…'}</p>
              <Timeline nowStep={nowStep} />
            </>
          )}
        </div>

        <aside aria-label="Ask and estimates" className="flex min-h-0 flex-col gap-4 overflow-y-auto pl-1">
          <AskBox status={fc.status} noAction={fc.noAction} withPlan={fc.withPlan} />
          <EstimatesPanel estimates={fc.bundle?.estimates ?? []} stale={fc.estimatesStale} />
        </aside>
      </div>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
