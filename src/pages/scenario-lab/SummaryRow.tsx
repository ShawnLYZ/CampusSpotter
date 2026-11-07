import type { Forecast, InputBundle, Summary } from '@engine/index.ts';
import { CostBadge, FigureBadge } from '../../components/FigureBadge.tsx';
import type { SourceInfo } from '../../providers/types.ts';
import { rowMetrics, summaryRows } from './summaryRows.ts';

interface Props { noAction: Summary; withPlan: Summary; forecasts: readonly Forecast[]; bundle?: InputBundle; sources?: SourceInfo[] }

export function SummaryRow({ noAction, withPlan, forecasts, bundle, sources }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="mb-2 text-left text-sm font-semibold text-text">Summary</caption>
      <thead>
        <tr className="text-left text-xs text-text-2">
          <th scope="col" className="py-1.5 pr-2 font-medium">Measure</th>
          <th scope="col" className="py-1.5 pr-2 font-medium">No action</th>
          <th scope="col" className="py-1.5 pr-2 font-medium">With plan</th>
          <th scope="col" className="py-1.5 font-medium">Source</th>
        </tr>
      </thead>
      <tbody>
        {summaryRows(noAction, withPlan).map((r) => {
          const metrics = rowMetrics(r.label);
          return (
            <tr key={r.label} className="border-t border-border">
              <th scope="row" className="py-1.5 pr-2 text-left font-normal text-text-2">{r.label}</th>
              <td className="tabular py-1.5 pr-2 text-text">{r.noAction}</td>
              <td className="tabular py-1.5 pr-2 text-text">{r.withPlan}</td>
              <td className="py-1 text-xs">
                {metrics === null ? <CostBadge /> : metrics ? <FigureBadge forecasts={forecasts} bundle={bundle} sources={sources} metrics={metrics} /> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
