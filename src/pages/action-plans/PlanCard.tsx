import type { Forecast, InputBundle } from '@engine/index.ts';
import { CostBadge, FigureBadge } from '../../components/FigureBadge.tsx';
import { rmText } from '../../lib/format.ts';
import type { PlanProposal } from '../../providers/types.ts';
import { rowMetrics, summaryRows } from '../scenario-lab/summaryRows.ts';

const EFFECT = ['Peak APU stop wait', 'Total time in red', 'Student-hours spent waiting'];
const btn = 'rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verified';

const NOTE = "Label reflects the plan context's inputs, not the plan's own levers.";

interface Props {
  plan: PlanProposal; index: number; onChoose: () => void; onOpenLab: () => void;
  /** No-action forecast for the plan's context; effect figures take their label from its metrics. */
  forecast?: Forecast; bundle?: InputBundle;
}

export function PlanCard({ plan, index, onChoose, onOpenLab, forecast, bundle }: Props) {
  const rows = summaryRows(plan.noActionSummary, plan.summary);
  const effect = rows.filter((r) => EFFECT.includes(r.label));
  const learning = rows.find((r) => r.label === 'Learning disruption');
  const heading = `plan-${plan.id}-h`;
  return (
    <article aria-labelledby={heading} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-panel p-4">
      <h2 id={heading} className="text-lg font-semibold text-text"><span className="text-text-2">Plan {index + 1}: </span>{plan.name}</h2>
      {plan.overBudget && (
        <p role="alert" className="rounded-md border border-red bg-red/15 px-3 py-1.5 text-sm font-semibold text-[#fca5a5]">Over budget — not recommended</p>
      )}
      <section aria-label="Levers and costs">
        <p className="mb-1 flex items-center gap-2 text-xs text-text-2">Cost rates <CostBadge /></p>
        <ul className="flex flex-col gap-1 text-sm">
          {plan.costLines.map((c, i) => (
            <li key={i} className="flex justify-between gap-3"><span className="text-text">{c.text}</span><span className="tabular whitespace-nowrap text-text-2">{rmText(c.rm)}</span></li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold text-text">
          <span>Total (budget {rmText(plan.budgetRm)})</span><span className="tabular">{rmText(plan.totalCostRm)}</span>
        </p>
      </section>
      <section aria-label="Effect versus no action">
        <h3 className="mb-1 text-sm font-medium text-text-2">Effect vs no action</h3>
        <dl className="flex flex-col gap-1 text-sm">
          {effect.map((r) => (
            <div key={r.label} className="flex justify-between gap-3"><dt className="flex items-center gap-2 text-text-2">{r.label}{forecast && rowMetrics(r.label) && <span className="text-xs"><FigureBadge forecasts={[forecast]} bundle={bundle} metrics={rowMetrics(r.label)!} note={NOTE} /></span>}</dt><dd className="tabular text-text">{r.noAction} → {r.withPlan}</dd></div>
          ))}
          {learning && <div className="flex justify-between gap-3"><dt className="flex items-center gap-2 text-text-2">Learning disruption{forecast && <span className="text-xs"><FigureBadge forecasts={[forecast]} bundle={bundle} metrics={rowMetrics('Learning disruption')!} note={NOTE} /></span>}</dt><dd className="tabular text-text">{learning.withPlan}</dd></div>}
        </dl>
      </section>
      <section aria-label="Gemini's reasoning" className="rounded-md border border-ai p-3">
        <h3 className="mb-1 text-sm font-semibold text-[#c4b5fd]">Gemini&apos;s reasoning</h3>
        <p className="text-sm text-text">{plan.rationale}</p>
      </section>
      <div className="mt-auto flex gap-2">
        <button type="button" onClick={onChoose}
          className={`${btn} ${plan.overBudget ? 'border-border bg-panel-2 text-text' : 'border-accent bg-accent text-white'}`}>Choose plan</button>
        <button type="button" onClick={onOpenLab} className={`${btn} border-border bg-panel-2 text-text`}>Open in Scenario Lab</button>
      </div>
    </article>
  );
}
