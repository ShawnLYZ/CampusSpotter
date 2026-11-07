import { CircleHelp, CircleSlash } from 'lucide-react';
import { METRIC_TITLES } from '@engine/index.ts';
import type { Forecast, InputBundle, MetricId, MetricSeries } from '@engine/index.ts';
import { PRESSURE_STYLE } from '../../components/PressureBadge.tsx';
import { ProvenanceBadge } from '../../components/ProvenanceBadge.tsx';
import { clock12, formatMetric, pressureText } from '../../lib/format.ts';
import type { SourceInfo } from '../../providers/types.ts';

const GROUPS: { title: string; metrics: MetricId[] }[] = [
  { title: 'Shuttle and roads', metrics: ['apuStopQueue', 'lrtStopQueue', 'shuttleRtt', 'roadDelay', 'lrtCrowding'] },
  { title: 'On campus', metrics: ['classroomOccupancy', 'cafeteriaQueue', 'walkwayTraffic', 'buildingEnergy'] },
];
const DAY_START_MIN = 7 * 60;
const STEP_MIN = 15;

function peakText(metric: MetricId, series: MetricSeries): string {
  let peakIdx = -1;
  series.steps.forEach((s, i) => {
    if (s.status === 'ok' && s.value !== null && (peakIdx < 0 || s.value > (series.steps[peakIdx].value as number))) peakIdx = i;
  });
  return peakIdx < 0 ? 'No peak (no data)'
    : `Peak ${formatMetric(metric, series.steps[peakIdx])}, ${clock12(DAY_START_MIN + peakIdx * STEP_MIN)}`;
}

function MetricRow({ metric, series, step, bundle, sources }: {
  metric: MetricId; series: MetricSeries; step: number; bundle: InputBundle; sources?: SourceInfo[];
}) {
  const sv = series.steps[step];
  const p = sv?.pressure ?? null;
  const style = p ? PRESSURE_STYLE[p] : null;
  const Icon = style?.Icon ?? (sv?.status === 'no_service' ? CircleSlash : CircleHelp);
  const word = p ? pressureText(p) : sv?.status === 'no_service' ? 'No service' : 'Not enough data';
  return (
    <li aria-label={METRIC_TITLES[metric]} className={`flex items-center gap-3 rounded-lg px-3 py-1.5 ${style?.tint ?? ''}`}>
      <Icon aria-hidden="true" strokeWidth={2.25} className={`h-5 w-5 shrink-0 ${style?.ink ?? 'text-text-3'}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{METRIC_TITLES[metric]}</p>
        <p className="figure truncate text-xs text-text-3">
          <span className={`font-medium ${style?.word ?? 'text-text-2'}`}>{word}</span> · {peakText(metric, series)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="figure text-[15px] font-medium leading-5 text-text">{sv ? formatMetric(metric, sv) : 'Not enough data'}</span>
        <ProvenanceBadge label={sv?.provenance ?? null} inputs={series.inputs} bundle={bundle} sources={sources} />
      </div>
    </li>
  );
}

/** Status board: one row per metric at the selected time, grouped by where it happens. */
export function MetricGrid({ forecast, step, bundle, sources }: { forecast: Forecast; step: number; bundle: InputBundle; sources?: SourceInfo[] }) {
  const all = GROUPS.flatMap((g) => g.metrics);
  const red = all.filter((m) => forecast.metrics[m].steps[step]?.pressure === 'red').length;
  const amber = all.filter((m) => forecast.metrics[m].steps[step]?.pressure === 'amber').length;
  const at = clock12(DAY_START_MIN + step * STEP_MIN);
  const headline = red > 0
    ? `${red} overloaded${amber ? `, ${amber} busy` : ''} at ${at}`
    : amber > 0 ? `${amber} busy at ${at}, nothing overloaded` : `Everything normal at ${at}`;
  const tone = red > 0 ? 'text-red-ink' : amber > 0 ? 'text-amber-ink' : 'text-green-ink';
  return (
    <section aria-labelledby="board-h" className="card p-3">
      <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
        <h2 id="board-h" className="section-title">Status at the selected time</h2>
        <p aria-live="polite" className={`tabular text-sm font-medium ${tone}`}>{headline}</p>
      </div>
      {GROUPS.map((g) => (
        <div key={g.title} className="mt-1">
          <h3 className="px-1 pb-1 pt-2 text-xs font-medium text-text-3">{g.title}</h3>
          <ul className="flex flex-col gap-0.5">
            {g.metrics.map((m) => (
              <MetricRow key={m} metric={m} series={forecast.metrics[m]} step={step} bundle={bundle} sources={sources} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
