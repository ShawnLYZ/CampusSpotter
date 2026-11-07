import type { Forecast, InputBundle, Summary } from '@engine/index.ts';
import { CostBadge, FigureBadge } from '../../components/FigureBadge.tsx';
import type { PlanProposal } from '../../providers/types.ts';
import { rowMetrics } from '../scenario-lab/summaryRows.ts';
import { comparisonRows } from './planUtils.ts';

interface Props { noAction: Summary; plans: PlanProposal[]; forecast?: Forecast; bundle?: InputBundle }

export function ComparisonTable({ noAction, plans, forecast, bundle }: Props) {
  const rows = comparisonRows(noAction, plans);
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-panel">
      <table className="w-full text-sm">
        <caption className="px-3 py-2 text-left text-sm font-semibold text-text">Plan comparison</caption>
        <thead>
          <tr className="border-b border-border text-left text-text-2">
            <th scope="col" className="px-3 py-2 font-medium">Measure</th>
            <th scope="col" className="px-3 py-2 font-medium">No action</th>
            {plans.map((p, i) => <th key={p.id} scope="col" className="px-3 py-2 font-medium">Plan {i + 1}: {p.name}</th>)}
            <th scope="col" className="px-3 py-2 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-normal text-text-2">{r.label}</th>
              <td className="tabular px-3 py-2 text-text">{r.noAction}</td>
              {r.plans.map((v, i) => <td key={i} className="tabular px-3 py-2 text-text">{v}</td>)}
              <td className="px-3 py-1 text-xs">
                {rowMetrics(r.label) === null ? <CostBadge />
                  : forecast && rowMetrics(r.label) ? <FigureBadge forecasts={[forecast]} bundle={bundle} metrics={rowMetrics(r.label)!} note="Label reflects the plan context's inputs, not each plan's own levers." /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
