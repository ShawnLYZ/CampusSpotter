import type { Forecast, InputBundle } from '@engine/index.ts';
import { CostBadge, FigureBadge } from '../../components/FigureBadge.tsx';
import { rmText } from '../../lib/format.ts';
import type { PlanProposal } from '../../providers/types.ts';
import { rowMetrics, summaryRows } from '../scenario-lab/summaryRows.ts';
import { CircleAlert, FlaskConical, MessageSquareText } from 'lucide-react';

const EFFECT = ['Peak APU stop wait', 'Total time in red', 'Student-hours spent waiting'];

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
    <article aria-labelledby={heading} className={`card flex min-w-0 flex-col gap-4 p-5 ${plan.overBudget ? 'border-red/40' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 id={heading} className="text-lg font-medium leading-snug text-text">
          <span className="tabular mb-1 block text-xs text-text-3">Plan {index + 1}</span>{plan.name}
        </h2>
        <span className={`figure shrink-0 rounded-lg px-2.5 py-1 text-lg font-medium ${plan.overBudget ? 'bg-red/15 text-red-ink' : 'bg-panel-3 text-text'}`}>{rmText(plan.totalCostRm)}</span>
      </div>
      {plan.overBudget && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-red/60 bg-red/15 px-3 py-2 text-sm font-medium text-red-ink">
          <CircleAlert aria-hidden="true" className="h-4 w-4" /> Over budget, so not recommended
        </p>
      )}
      <section aria-label="Levers and costs">
        <p className="mb-1 flex items-center gap-2 text-xs text-text-2">Cost rates <CostBadge /></p>
        <ul className="flex flex-col gap-1 text-sm">
          {plan.costLines.map((c, i) => (
            <li key={i} className="flex justify-between gap-3"><span className="text-text">{c.text}</span><span className="figure whitespace-nowrap text-text-2">{rmText(c.rm)}</span></li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-medium text-text">
          <span>Total (budget {rmText(plan.budgetRm)})</span><span className="figure">{rmText(plan.totalCostRm)}</span>
        </p>
      </section>
      <section aria-label="Effect versus no action" className="rounded-xl bg-bg/60 p-3">
        <h3 className="mb-2 text-sm font-medium text-text">What it achieves <span className="font-normal text-text-3">(no action → with this plan)</span></h3>
        <dl className="flex flex-col gap-1 text-sm">
          {effect.map((r) => (
            <div key={r.label} className="flex justify-between gap-3"><dt className="flex items-center gap-2 text-text-2">{r.label}{forecast && rowMetrics(r.label) && <span className="text-xs"><FigureBadge forecasts={[forecast]} bundle={bundle} metrics={rowMetrics(r.label)!} note={NOTE} /></span>}</dt><dd className="figure whitespace-nowrap text-text-2">{r.noAction} → <span className="font-medium text-text">{r.withPlan}</span></dd></div>
          ))}
          {learning && <div className="flex justify-between gap-3"><dt className="flex items-center gap-2 text-text-2">Learning disruption{forecast && <span className="text-xs"><FigureBadge forecasts={[forecast]} bundle={bundle} metrics={rowMetrics('Learning disruption')!} note={NOTE} /></span>}</dt><dd className="figure text-text">{learning.withPlan}</dd></div>}
        </dl>
      </section>
      <section aria-label="Gemini's reasoning" className="rounded-xl border border-ai/50 bg-ai/[0.07] p-3">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ai-ink"><MessageSquareText aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5" />Gemini&apos;s reasoning</h3>
        <p className="text-sm leading-relaxed text-text-2">{plan.rationale}</p>
      </section>
      <div className="mt-auto flex flex-wrap gap-2">
        <button type="button" onClick={onChoose} className={`btn ${plan.overBudget ? '' : 'btn-primary'}`}>Choose this plan</button>
        <button type="button" onClick={onOpenLab} className="btn btn-quiet"><FlaskConical aria-hidden="true" /> Fine-tune in Scenario Lab</button>
      </div>
    </article>
  );
}
