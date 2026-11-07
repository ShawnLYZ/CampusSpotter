import { useEffect, useState } from 'react';
import { useProvider } from '../../app/ProviderContext.tsx';
import { EstimateCard } from '../../components/EstimateCard.tsx';
import { dateText } from '../../lib/format.ts';
import type { EstimateView } from '../../providers/types.ts';

export function EstimatesTab() {
  const provider = useProvider();
  const [rows, setRows] = useState<EstimateView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    provider.listEstimates().then(setRows, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [provider]);

  if (error) return <p role="alert" className="text-red">{error}</p>;
  if (!rows) return <p role="status" className="text-text-2">Loading estimates…</p>;
  if (rows.length === 0) return <p className="text-text-2">No AI estimates yet.</p>;
  const groups = new Map<string, EstimateView[]>();
  for (const r of rows) groups.set(r.disruptionTitle, [...(groups.get(r.disruptionTitle) ?? []), r]);
  return (
    <div className="flex flex-col gap-6">
      {[...groups].map(([title, list]) => (
        <section key={title} aria-label={title}>
          <h2 className="mb-2 text-lg font-semibold text-text">{title} <span className="text-sm font-normal text-text-2">· {dateText(list[0].date)}</span></h2>
          <div className="grid grid-cols-3 gap-3">
            {list.map((e) => <EstimateCard key={`${e.disruptionId}-${e.key}`} estimate={e} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
