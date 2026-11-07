import type { Forecast, InputBundle, MetricId } from '@engine/index.ts';
import { figureProvenance } from '../lib/figureProvenance.ts';
import type { SourceInfo } from '../providers/types.ts';
import { ProvenanceBadge } from './ProvenanceBadge.tsx';

interface Props {
  /** Every forecast the figure reads; the label is the weakest across them. */
  forecasts: readonly Forecast[]; bundle?: InputBundle; sources?: SourceInfo[]; metrics: readonly MetricId[];
  /** Tooltip explaining what the label reflects. */
  note?: string;
}

/** Provenance badge for a figure computed from these metrics; the popover lists the inputs when a bundle is given. */
export function FigureBadge({ forecasts, bundle, sources, metrics, note }: Props) {
  const p = figureProvenance(forecasts, metrics);
  return (
    <span title={note}>
      <ProvenanceBadge label={p.label} inputs={bundle ? p.inputs : undefined} bundle={bundle} sources={sources} />
    </span>
  );
}

/** Cost rates come from Baseline (assumed APU data). */
export function CostBadge() {
  return <ProvenanceBadge label="baseline" />;
}
