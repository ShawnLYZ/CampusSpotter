import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { METRIC_IDS, METRIC_TITLES } from '@engine/index.ts';
import type { Forecast, InputBundle, MetricId, Settings } from '@engine/index.ts';
import { FigureBadge } from '../../components/FigureBadge.tsx';
import { clock12, formatMetric } from '../../lib/format.ts';

export const NO_ACTION_COLOUR = '#94a3b8';
export const WITH_PLAN_COLOUR = '#38bdf8';
const START_MIN = 420;
const TICKS = Array.from({ length: 7 }, (_, i) => i * 12); // every 3 hours

const shortClock = (step: number) => clock12(START_MIN + step * 15).replace(':00', '');

interface Point { t: number; a: number | null; b: number | null }

function pointsOf(metric: MetricId, noAction: Forecast, withPlan: Forecast): Point[] {
  const a = noAction.metrics[metric].steps;
  const b = withPlan.metrics[metric].steps;
  return a.map((s, t) => ({
    t,
    a: s.status === 'ok' ? s.value : null,
    b: b[t]?.status === 'ok' ? b[t].value : null,
  }));
}

interface TipProps { active?: boolean; label?: number | string; metric: MetricId; noAction: Forecast; withPlan: Forecast }
function Tip({ active, label, metric, noAction, withPlan }: TipProps) {
  const t = Number(label);
  if (!active || Number.isNaN(t)) return null;
  const a = noAction.metrics[metric].steps[t];
  const b = withPlan.metrics[metric].steps[t];
  if (!a || !b) return null;
  return (
    <div className="rounded-md border border-border bg-panel-2 px-2 py-1.5 text-xs text-text shadow-lg">
      <p className="mb-1 font-medium">{clock12(START_MIN + t * 15)}</p>
      <p className="tabular"><span style={{ color: NO_ACTION_COLOUR }}>No action</span>: {formatMetric(metric, a)}</p>
      <p className="tabular"><span style={{ color: WITH_PLAN_COLOUR }}>With plan</span>: {formatMetric(metric, b)}</p>
    </div>
  );
}

interface Props {
  noAction: Forecast; withPlan: Forecast; thresholds: Settings['thresholds']; step: number;
  metrics?: readonly MetricId[]; chartHeight?: number; bundle?: InputBundle;
}

export function SmallMultiples({ noAction, withPlan, thresholds, step, metrics = METRIC_IDS, chartHeight = 150, bundle }: Props) {
  return (
    <section aria-label="Metric forecasts, no action against with plan">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-text-2">
        <h2 className="section-title mr-auto">Each measure through the day</h2>
        <span className="flex items-center gap-1.5 whitespace-nowrap"><span aria-hidden="true" className="inline-block h-0.5 w-5" style={{ background: NO_ACTION_COLOUR }} />No action</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap"><span aria-hidden="true" className="inline-block h-1 w-5" style={{ background: WITH_PLAN_COLOUR }} />With plan</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap"><span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-amber" />Busy from</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap"><span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-red" />Overloaded above</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => {
          const data = pointsOf(m, noAction, withPlan);
          const th = thresholds[m];
          const dataMax = Math.max(0, ...data.flatMap((p) => [p.a ?? 0, p.b ?? 0]));
          const yMax = Math.ceil(Math.max(th.redAbove * 1.15, dataMax * 1.05));
          return (
            <figure key={m} className="card min-w-0 p-3">
              <figcaption className="mb-2 flex min-h-[2.5rem] items-start justify-between gap-2 text-sm font-medium leading-tight text-text">
                <span>{METRIC_TITLES[m]}</span>
                <span className="shrink-0 text-xs"><FigureBadge forecasts={[noAction, withPlan]} bundle={bundle} metrics={[m]} /></span>
              </figcaption>
              <div style={{ height: chartHeight }} className="min-w-0">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 260, height: chartHeight }}>
                  <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#263445" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="t" type="number" domain={[0, 75]} ticks={TICKS} tickFormatter={shortClock}
                      tick={{ fill: '#8a99ab', fontSize: 10 }} stroke="#263445" />
                    <YAxis domain={[0, yMax]} width={36} tick={{ fill: '#8a99ab', fontSize: 10 }} stroke="#263445" allowDecimals={false} />
                    <ReferenceLine y={th.amberFrom} stroke="#f59e0b" strokeDasharray="4 3" />
                    <ReferenceLine y={th.redAbove} stroke="#ef4444" strokeDasharray="4 3" />
                    <ReferenceLine x={step} stroke="#e6edf3" strokeOpacity={0.7} />
                    <Tooltip content={<Tip metric={m} noAction={noAction} withPlan={withPlan} />} />
                    <Line dataKey="a" stroke={NO_ACTION_COLOUR} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls={false} />
                    <Line dataKey="b" stroke={WITH_PLAN_COLOUR} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
