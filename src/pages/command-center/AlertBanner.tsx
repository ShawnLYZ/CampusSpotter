import type { Forecast, InputBundle } from '@engine/index.ts';
import { FigureBadge } from '../../components/FigureBadge.tsx';
import { RiskBadge } from '../../components/RiskBadge.tsx';
import type { EarlyWarningItem, SourceInfo } from '../../providers/types.ts';

interface Props {
  item: EarlyWarningItem | null; onOpen: (item: EarlyWarningItem) => void;
  /** The no-action forecast for the alert's own date and disruption; its APU stop queue metric labels the figures. */
  forecast?: Forecast; bundle?: InputBundle; sources?: SourceInfo[];
}

export function AlertBanner({ item, onOpen, forecast, bundle, sources }: Props) {
  if (!item) return <p className="rounded-lg border border-border bg-panel px-4 py-3 text-sm text-text-2">No upcoming disruptions</p>;
  const when = item.daysRemaining === 0 ? 'today' : `in ${item.daysRemaining} ${item.daysRemaining === 1 ? 'day' : 'days'}`;
  return (
    <section aria-label="Upcoming disruption alert" className="rounded-lg border border-border bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-text">{item.title}</h2>
        <RiskBadge level={item.riskLevel} reason={item.riskReason ?? undefined} />
      </div>
      {item.riskReason && (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-2">
          <span>{item.riskReason}</span>
          {forecast && <span className="text-xs"><FigureBadge forecasts={[forecast]} bundle={bundle} sources={sources} metrics={['apuStopQueue']} /></span>}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="tabular text-sm font-medium text-amber">{when}</span>
        <button type="button" onClick={() => onOpen(item)}
          className="rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm font-medium text-text">
          Open in Scenario Lab
        </button>
      </div>
    </section>
  );
}
