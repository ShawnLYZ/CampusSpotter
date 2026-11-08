import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { stepOf } from '@engine/index.ts';
import type { LeverSet } from '@engine/index.ts';
import { addDays, mytDate } from '../../lib/dates.ts';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useContextStore } from '../../store/context.ts';
import { useTimeStore } from '../../store/time.ts';
import { useForecast } from '../../hooks/useForecast.ts';
import { useSubscription } from '../../hooks/useSubscription.ts';
import { SceneSlot } from '../../scene/SceneSlot.tsx';
import { Timeline } from '../../components/Timeline.tsx';
import { MapPanel } from '../../components/MapPanel.tsx';
import { NoClassesState } from '../../components/NoClassesState.tsx';
import { StaleBanner } from '../../components/StaleBanner.tsx';
import type { ContextRequest, EarlyWarningItem, SourceInfo, Today } from '../../providers/types.ts';
import { AlertBanner } from './AlertBanner.tsx';
import { MetricGrid } from './MetricGrid.tsx';
import { ZonePopover } from './ZonePopover.tsx';
import { pickAlert } from './alert.ts';
import { LayoutDashboard } from 'lucide-react';
import { PageIntro } from '../../components/PageIntro.tsx';
import { Legend } from '../../components/Legend.tsx';
import { worstPressureByStep } from '../../lib/worstPressure.ts';

const clampStep = (n: number) => Math.min(75, Math.max(0, n));
const NO_LEVERS: LeverSet = [];

export default function CommandCenterPage() {
  const provider = useProvider();
  const navigate = useNavigate();
  const ctx = useContextStore((s) => s.ctx);
  const setCtx = useContextStore((s) => s.setCtx);
  const step = useTimeStore((s) => s.step);
  const setStep = useTimeStore((s) => s.setStep);
  const fc = useForecast(ctx, NO_LEVERS);

  const [today, setToday] = useState<Today | null>(null);
  const [items, setItems] = useState<EarlyWarningItem[]>([]);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [zone, setZone] = useState<string | null>(null);
  const initialised = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void provider.getToday().then((t) => { if (!cancelled) setToday(t); });
    void provider.listSources().then((s) => { if (!cancelled) setSources(s); });
    return () => { cancelled = true; };
  }, [provider]);

  const loadItems = useCallback(() => {
    if (!today) return;
    void provider.listDisruptions({ from: today.date, to: addDays(today.date, 180) }).then(setItems);
  }, [provider, today]);
  useEffect(loadItems, [loadItems]);
  useSubscription('disruptions', loadItems);

  const nowStep = today !== null && ctx.date === today.date ? clampStep(stepOf(today.nowMin)) : null;

  useEffect(() => {
    if (initialised.current || !today) return;
    initialised.current = true;
    setStep(ctx.date === today.date ? clampStep(stepOf(today.nowMin)) : 12);
  }, [today, ctx.date, setStep]);

  const alert = pickAlert(items);
  const openAlert = (item: EarlyWarningItem) => {
    setCtx({ date: mytDate(item.startAt), disruptionId: item.id });
    void navigate('/scenario-lab');
  };
  // The alert label comes from the alert's own date and disruption, not the day on screen.
  const alertCtx = useMemo<ContextRequest>(() => (alert ? { date: mytDate(alert.startAt), disruptionId: alert.id } : ctx), [alert, ctx]);
  const alertFc = useForecast(alertCtx, NO_LEVERS);
  const closeZone = useCallback(() => setZone(null), []);
  const dayType = fc.bundle?.context.dayType;
  const strip = useMemo(() => (fc.noAction ? worstPressureByStep(fc.noAction) : undefined), [fc.noAction]);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-4">
      <PageIntro id="command-center" Icon={LayoutDashboard} compact title="Command Center"
        summary="How the chosen day unfolds on campus and along the shuttle route, if nothing is changed."
        steps={['Press Play or drag the time slider', 'Watch places turn amber (busy) or red (overloaded)', 'Click a building or a label for details']} />
      <div><StaleBanner sources={sources} /></div>
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_460px] gap-4">
        <div className="card relative flex min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <h2 className="section-title">3D campus and shuttle route</h2>
            <Legend />
          </div>
          <div className="relative min-h-0 flex-1">
            {fc.status === 'ready' && fc.noAction ? (
              <SceneSlot mode="single" forecasts={[fc.noAction]} step={step} onZoneClick={setZone}
                weatherMm={fc.bundle?.weather?.precipitationMm.map((p) => p?.value ?? null)} />
            ) : (
              <p role="status" className="p-6 text-text-2">{fc.status === 'error' ? `Forecast unavailable: ${fc.error}` : 'Loading forecast…'}</p>
            )}
            {zone && fc.noAction && fc.bundle && (
              <ZonePopover zoneId={zone} forecast={fc.noAction} step={step} bundle={fc.bundle} sources={sources} onClose={closeZone} />
            )}
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          <AlertBanner item={alert} onOpen={openAlert} forecast={alertFc.noAction} bundle={alertFc.bundle} sources={sources} />
          {(dayType === 'weekend' || dayType === 'no_class') && <NoClassesState dayType={dayType} />}
          {fc.status === 'ready' && fc.noAction && fc.bundle && <MetricGrid forecast={fc.noAction} step={step} bundle={fc.bundle} sources={sources} />}
          <section aria-label="Live traffic map" className="card shrink-0 overflow-hidden">
            <h2 className="section-title px-4 py-2.5">Live traffic: APU to LRT Bukit Jalil</h2>
            <MapPanel height={220} />
          </section>
        </div>
      </div>
      <Timeline nowStep={nowStep} pressures={strip} />
    </div>
  );
}
