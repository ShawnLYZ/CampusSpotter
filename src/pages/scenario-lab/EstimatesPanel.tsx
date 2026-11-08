import type { Estimate } from '@engine/index.ts';
import { EstimateCard } from '../../components/EstimateCard.tsx';

export function EstimatesPanel({ estimates, stale }: { estimates: Estimate[]; stale?: boolean }) {
  return (
    <section aria-labelledby="ai-estimates">
      <h2 id="ai-estimates" className="section-title">AI-estimated inputs</h2>
      <p className="mb-3 mt-1 text-xs text-text-2">The unknowns Gemini filled in for this day. The engine uses the likely value.</p>
      {stale === true && <p role="status" className="mb-3 text-xs text-text-2">Using last saved estimates — Gemini unavailable</p>}
      {estimates.length === 0
        ? <p className="text-sm text-text-2">No AI estimates are used for this day.</p>
        : <div className="flex flex-col gap-2">{estimates.map((e) => <EstimateCard key={e.key} estimate={e} />)}</div>}
    </section>
  );
}
