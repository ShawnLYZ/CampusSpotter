import type { InputBundle, MetricId, MetricSeries } from '@engine/index.ts';
import { METRIC_TITLES } from '@engine/index.ts';
import { clock12, formatMetric } from '../lib/format.ts';
import { PressureBadge } from './PressureBadge.tsx';
import { ProvenanceBadge } from './ProvenanceBadge.tsx';
import type { SourceInfo } from '../providers/types.ts';

const DAY_START_MIN = 7 * 60;
const STEP_MIN = 15;

export function MetricTile({ metric, series, step, bundle, sources }: {
  metric: MetricId; series: MetricSeries; step: number; bundle: InputBundle; sources?: SourceInfo[];
}) {
  const sv = series.steps[step];
  let peakIdx = -1;
  series.steps.forEach((s, i) => {
    if (s.status === 'ok' && s.value !== null && (peakIdx < 0 || s.value > (series.steps[peakIdx].value as number))) peakIdx = i;
  });
  const peakText = peakIdx < 0 ? 'No peak (no data)'
    : `Peak ${formatMetric(metric, series.steps[peakIdx])} at ${clock12(DAY_START_MIN + peakIdx * STEP_MIN)}`;
  return (
    <section aria-label={METRIC_TITLES[metric]} className="card p-4">
      <h3 className="text-sm font-medium text-text-2">{METRIC_TITLES[metric]}</h3>
      <p className="tabular mt-1 text-3xl font-semibold text-text">{sv ? formatMetric(metric, sv) : 'Not enough data'}</p>
      <p className="tabular mt-1 text-sm text-text-2">{peakText}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PressureBadge pressure={sv?.pressure ?? null} status={sv?.status ?? 'not_enough_data'} />
        <ProvenanceBadge label={sv?.provenance ?? null} inputs={series.inputs} bundle={bundle} sources={sources} />
      </div>
    </section>
  );
}
