import { METRIC_IDS } from '@engine/index.ts';
import type { Forecast, InputBundle } from '@engine/index.ts';
import { MetricTile } from '../../components/MetricTile.tsx';
import type { SourceInfo } from '../../providers/types.ts';

export function MetricGrid({ forecast, step, bundle, sources }: { forecast: Forecast; step: number; bundle: InputBundle; sources?: SourceInfo[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {METRIC_IDS.map((m) => (
        <MetricTile key={m} metric={m} series={forecast.metrics[m]} step={step} bundle={bundle} sources={sources} />
      ))}
    </div>
  );
}
