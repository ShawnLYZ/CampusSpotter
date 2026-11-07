import { METRIC_IDS, METRIC_TITLES } from '@engine/index.ts';
import type { Forecast, InputBundle } from '@engine/index.ts';
import { PressureBadge } from '../components/PressureBadge.tsx';
import { ProvenanceBadge } from '../components/ProvenanceBadge.tsx';
import { formatMetric } from '../lib/format.ts';
import type { SourceInfo } from '../providers/types.ts';
import { ZONES, valueFor, type MetricRef } from './zones.ts';

/** Every campus-wide metric; shown for an id that isn't a scene zone (e.g. the P3 placeholder's 'campus'). */
const CAMPUS_FALLBACK = { name: 'Campus', metrics: METRIC_IDS.map((metric): MetricRef => ({ metric, scope: 'campus' })) };

/** Name and metric list for a scene zone id, falling back to all campus metrics for an unknown id. */
export function zoneInfo(zoneId: string): { name: string; metrics: MetricRef[] } {
  return ZONES.find((z) => z.id === zoneId) ?? CAMPUS_FALLBACK;
}

/** One row per metric of the zone: title, value, pressure badge and provenance badge (as on `MetricTile`). */
export function ZoneDetails({ zoneId, forecast, step, bundle, sources }: {
  zoneId: string; forecast: Forecast; step: number; bundle: InputBundle; sources?: SourceInfo[];
}) {
  const { metrics } = zoneInfo(zoneId);
  if (metrics.length === 0) return <p className="text-sm text-text-2">No live figures for this zone.</p>;
  return (
    <ul className="space-y-3">
      {metrics.map((ref) => {
        const sv = valueFor(ref, forecast, step);
        return (
          <li key={`${ref.metric}:${ref.scope}`}>
            <p className="text-sm text-text-2">{METRIC_TITLES[ref.metric]}</p>
            <p className="tabular text-lg font-semibold text-text">{sv ? formatMetric(ref.metric, sv) : 'Not enough data'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <PressureBadge pressure={sv?.pressure ?? null} status={sv?.status ?? 'not_enough_data'} />
              <ProvenanceBadge label={sv?.provenance ?? null} inputs={forecast.metrics[ref.metric].inputs} bundle={bundle} sources={sources} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

