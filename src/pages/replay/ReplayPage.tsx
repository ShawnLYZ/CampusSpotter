import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { buildChecklist } from '@plans/checklist.ts';
import type { Team } from '@plans/checklist.ts';
import { REPLAY_PLAN_4NOV } from '@plans/replayPlan.ts';
import { useProvider } from '../../app/ProviderContext.tsx';
import { ProvenanceBadge } from '../../components/ProvenanceBadge.tsx';
import { Timeline } from '../../components/Timeline.tsx';
import { TypedText } from '../../components/TypedText.tsx';
import { useForecast } from '../../hooks/useForecast.ts';
import { clock12, rmText } from '../../lib/format.ts';
import { announcementScripted } from './announcement.ts';
import type { ContextRequest, PlanProposal, StationDay } from '../../providers/types.ts';
import { SceneSlot } from '../../scene/SceneSlot.tsx';
import { useContextStore } from '../../store/context.ts';
import { useTimeStore } from '../../store/time.ts';
import { summaryRows } from '../scenario-lab/summaryRows.ts';
import { Jun3Card } from './Jun3Card.tsx';
import { MilestoneStrip } from './MilestoneStrip.tsx';
import { replayNarrative } from './replayData.ts';
import type { Milestone } from './replayData.ts';
import { stationText } from './stationText.ts';
import { History } from 'lucide-react';
import { PageIntro } from '../../components/PageIntro.tsx';

const REPLAY_CTX: ContextRequest = { date: '2026-11-04', disruptionId: 'weeknd-2026-11-04', reconstructed: true };
/** Steps are 15 minutes from 7:00 AM: 12:00 PM is step 20, 6:15 PM is step 45. */
const PLAY_FROM = 20;
const PLAY_TO = 45;
const TEAM_TITLE: Record<Team, string> = { transport: 'Transport', facilities: 'Facilities', cafeteria: 'Cafeteria', academic: 'Academic' };
const TEAMS: Team[] = ['transport', 'facilities', 'cafeteria', 'academic'];
const ESTIMATE = 'reconstructed estimate';

export default function ReplayPage() {
  const provider = useProvider();
  const setCtx = useContextStore((s) => s.setCtx);
  const step = useTimeStore((s) => s.step);
  const [active, setActive] = useState<Milestone['id']>('nov4');
  // Levers are local to this page; the global lever store is left alone.
  const fc = useForecast(REPLAY_CTX, REPLAY_PLAN_4NOV);
  const [station, setStation] = useState<StationDay | null>(null);

  useEffect(() => { setCtx(REPLAY_CTX); }, [setCtx]);
  useEffect(() => {
    let cancelled = false;
    void provider.getStationDay(REPLAY_CTX.date).then((d) => { if (!cancelled) setStation(d); }, () => { if (!cancelled) setStation(null); });
    return () => { cancelled = true; };
  }, [provider]);

  // The day view plays 12:00 PM to 6:15 PM; other milestones leave the shared clock alone.
  const ready = fc.status === 'ready' && !!fc.bundle && !!fc.noAction && !!fc.withPlan;
  useEffect(() => {
    const prevSpeed = useTimeStore.getState().speed;
    if (active === 'nov4' && ready) {
      const t = useTimeStore.getState();
      t.setRange({ from: PLAY_FROM, to: PLAY_TO });
      t.setStep(PLAY_FROM);
      t.setSpeed(4);
      t.play();
    }
    return () => { const s = useTimeStore.getState(); s.pause(); s.setRange(null); s.setSpeed(prevSpeed); };
  }, [active, ready]);

  const checklist = useMemo(() => (fc.bundle ? buildChecklist(REPLAY_PLAN_4NOV, fc.bundle) : null), [fc.bundle]);
  const announcement = useMemo(
    () => (checklist ? announcementScripted({ levers: REPLAY_PLAN_4NOV } as PlanProposal, REPLAY_CTX, null, checklist) : null),
    [checklist],
  );
  const narrative = useMemo(
    () => (fc.noAction && fc.withPlan ? replayNarrative(fc.noAction.summary, fc.withPlan.summary, station) : null),
    [fc.noAction, fc.withPlan, station],
  );

  let main: ReactNode;
  if (active === 'jun3') {
    main = <Jun3Card />;
  } else if (!ready) {
    main = <p role="status" className="p-6 text-text-2">{fc.status === 'error' ? `Forecast unavailable: ${fc.error}` : 'Loading forecast…'}</p>;
  } else if (active === 'oct21') {
    main = (
      <section aria-label="Plan summary" className="card p-5">
        <h2 className="text-lg font-medium">Plan chosen on 21 Oct</h2>
        <p className="text-xs text-text-2">Costs are a {ESTIMATE}.</p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {fc.withPlan!.summary.costLines.map((c, i) => (
            <li key={i} className="flex justify-between gap-4 py-1.5"><span>{c.text}</span><span className="figure">{rmText(c.rm)}</span></li>
          ))}
          <li className="flex justify-between gap-4 py-1.5 font-medium"><span>Total</span><span className="figure">{rmText(fc.withPlan!.summary.totalCostRm)}</span></li>
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {TEAMS.map((team) => {
            const items = checklist!.filter((c) => c.team === team);
            return items.length === 0 ? null : (
              <div key={team}>
                <h3 className="text-sm font-medium">{TEAM_TITLE[team]}</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-text-2">
                  {items.map((c, i) => <li key={i}>{c.text}{c.dueMin !== null ? ` (by ${clock12(c.dueMin)})` : ''}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    );
  } else if (active === 'nov3') {
    main = (
      <section aria-label="Student announcement" className="card p-5">
        <h2 className="text-lg font-medium">Student announcement, 3 Nov</h2>
        <p className="text-xs text-text-2">Plan figures are a {ESTIMATE}.</p>
        <p className="mt-3 whitespace-pre-line text-base"><TypedText text={announcement!} /></p>
      </section>
    );
  } else {
    main = (
      <>
        <div className="h-[300px] shrink-0">
          <SceneSlot mode="split" forecasts={[fc.noAction!, fc.withPlan!]} captions={['What happened (no action)', "With CampusSpotter's plan"]}
            step={step} cameraPreset="overview" />
        </div>
        <Timeline nowStep={null} />
        <div className="card p-4">
          <table className="w-full border-collapse text-sm">
            <caption className="section-title mb-3 text-left">Key figures — {ESTIMATE}</caption>
            <thead>
              <tr className="text-left text-xs text-text-2">
                <th scope="col" className="py-1.5 pr-2 font-medium">Measure</th>
                <th scope="col" className="py-1.5 pr-2 font-medium">What happened (no action)</th>
                <th scope="col" className="py-1.5 font-medium">With CampusSpotter&apos;s plan</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows(fc.noAction!.summary, fc.withPlan!.summary).map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal text-text-2">{r.label}</th>
                  <td className="figure py-1.5 pr-2 text-text">{r.noAction}</td>
                  <td className="figure py-1.5 font-medium text-text">{r.withPlan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-5">
      <PageIntro id="replay" Icon={History} compact title="Replay: 4 Nov, night one"
        summary="The Weeknd concert night as it happened with no action, next to what CampusSpotter would have done. Click a step to jump through the story." />
      <MilestoneStrip active={active} onSelect={setActive} />
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_400px] gap-4">
        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto pr-1">{main}</div>
        <aside aria-label="What happened" className="flex min-h-0 flex-col gap-4 overflow-y-auto pl-1">
          <figure className="card p-2">
            <img src="/replay/concert-lrt-traffic.png" alt="Traffic around LRT Bukit Jalil on concert day" className="w-full rounded-md" />
            <figcaption className="mt-1 text-xs text-text-2">Illustration</figcaption>
          </figure>
          {station && (
            <div className="card p-4 text-sm">
              <p className="figure">{stationText(station)}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-2">
                <ProvenanceBadge label="verified" /> <span>Source: data-gov-my-ridership</span>
              </p>
            </div>
          )}
          <section className="card p-4">
            <h2 className="section-title">What happened</h2>
            <p className="mt-2 text-sm text-text-2">{narrative ? <TypedText text={narrative} /> : 'Loading…'}</p>
            <p className="mt-2 text-xs text-text-2">Figures: {ESTIMATE}.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
