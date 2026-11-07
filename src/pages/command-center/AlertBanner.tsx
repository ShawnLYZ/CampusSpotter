import { ArrowRight, BellRing, CircleCheck } from 'lucide-react';
import type { Forecast, InputBundle } from '@engine/index.ts';
import { FigureBadge } from '../../components/FigureBadge.tsx';
import { RiskBadge } from '../../components/RiskBadge.tsx';
import type { EarlyWarningItem, SourceInfo } from '../../providers/types.ts';

interface Props {
  item: EarlyWarningItem | null; onOpen: (item: EarlyWarningItem) => void;
  /** The no-action forecast for the alert's own date and disruption; its APU stop queue metric labels the figures. */
  forecast?: Forecast; bundle?: InputBundle; sources?: SourceInfo[];
}

const TONE = {
  critical: 'border-red/60 bg-[linear-gradient(135deg,rgb(153_27_27/0.35),transparent_70%)]',
  high: 'border-red/45 bg-red/[0.07]',
  medium: 'border-amber/45 bg-amber/[0.07]',
  low: 'border-border',
} as const;

export function AlertBanner({ item, onOpen, forecast, bundle, sources }: Props) {
  if (!item) {
    return (
      <p className="card flex items-center gap-3 px-4 py-3 text-sm text-text-2">
        <CircleCheck aria-hidden="true" className="h-5 w-5 text-green" /> No upcoming disruptions in the next 180 days.
      </p>
    );
  }
  const when = item.daysRemaining <= 0 ? 'Today' : `In ${item.daysRemaining} ${item.daysRemaining === 1 ? 'day' : 'days'}`;
  return (
    <section aria-label="Upcoming disruption alert" className={`rounded-[0.875rem] border bg-panel p-4 ${TONE[item.riskLevel ?? 'low']}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-2">
          <BellRing aria-hidden="true" className="h-3.5 w-3.5 text-amber" /> Biggest upcoming risk · <span className="tabular font-semibold text-amber-ink">{when}</span>
        </span>
        <RiskBadge level={item.riskLevel} reason={item.riskReason ?? undefined} />
      </div>
      <h2 className="mt-2 text-lg font-semibold leading-snug text-text">{item.title}</h2>
      {item.riskReason && (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-2">
          <span><span className="text-text-3">If nothing is done:</span> {item.riskReason}</span>
          {forecast && <FigureBadge forecasts={[forecast]} bundle={bundle} sources={sources} metrics={['apuStopQueue']} />}
        </p>
      )}
      <button type="button" onClick={() => onOpen(item)} className="btn btn-primary mt-3 w-full">
        Test responses in Scenario Lab <ArrowRight aria-hidden="true" />
      </button>
    </section>
  );
}
