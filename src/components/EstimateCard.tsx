import type { Estimate } from '@engine/index.ts';
import { ESTIMATE_KEYS } from '@engine/index.ts';
import type { EstimateView } from '../providers/types.ts';

const num = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
const scalarOrPeak = (v: number | number[], pick: 'min' | 'max') =>
  Array.isArray(v) ? Math[pick](...v) : v;

export function EstimateCard({ estimate }: { estimate: Estimate | EstimateView }) {
  const title = ESTIMATE_KEYS.find((k) => k.key === estimate.key)?.title ?? estimate.key;
  const isCurve = Array.isArray(estimate.likely);
  const likely = scalarOrPeak(estimate.likely, 'max');
  const low = scalarOrPeak(estimate.low, 'min');
  const high = scalarOrPeak(estimate.high, 'max');
  return (
    <article className="rounded-lg border border-ai/60 bg-panel p-4">
      <h3 className="text-sm font-medium text-text-2">{title}</h3>
      <p className="tabular mt-1 text-2xl font-semibold text-text">
        {isCurve ? 'Peak ' : ''}{num(likely)} <span className="text-base font-normal text-text-2">{estimate.unit}</span>
      </p>
      <p className="tabular text-sm text-text-2">Range {num(low)}–{num(high)} {estimate.unit}</p>
      <p className="mt-2 text-sm text-text">{estimate.reasoning}</p>
      <p className="mt-2 text-xs text-text-2">Confidence: {estimate.confidence} · Model: {estimate.model}</p>
    </article>
  );
}
