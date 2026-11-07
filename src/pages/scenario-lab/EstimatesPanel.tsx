import type { Estimate } from '@engine/index.ts';
import { EstimateCard } from '../../components/EstimateCard.tsx';

export function EstimatesPanel({ estimates }: { estimates: Estimate[] }) {
  return (
    <section aria-labelledby="ai-estimates">
      <h2 id="ai-estimates" className="mb-2 text-sm font-semibold text-text">AI-estimated inputs</h2>
      {estimates.length === 0
        ? <p className="text-sm text-text-2">No AI estimates are used for this day.</p>
        : <div className="flex flex-col gap-2">{estimates.map((e) => <EstimateCard key={e.key} estimate={e} />)}</div>}
    </section>
  );
}
