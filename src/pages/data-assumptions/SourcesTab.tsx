import { useEffect, useState } from 'react';
import { useProvider } from '../../app/ProviderContext.tsx';
import { ProvenanceBadge } from '../../components/ProvenanceBadge.tsx';
import { clock12, dateText } from '../../lib/format.ts';
import { mytDate, mytMinutes } from '../../lib/dates.ts';
import type { SourceInfo } from '../../providers/types.ts';

const STATUS: Record<SourceInfo['status'], { icon: string; word: string; cls: string }> = {
  ok: { icon: '●', word: 'Up to date', cls: 'border-green text-green' },
  stale: { icon: '▲', word: 'Stale', cls: 'border-amber text-amber' },
  failed: { icon: '■', word: 'Failed', cls: 'border-red text-red' },
  static: { icon: '◆', word: 'Static', cls: 'border-baseline text-text-2' },
};

export function SourcesTab() {
  const provider = useProvider();
  const [rows, setRows] = useState<SourceInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    provider.listSources().then(setRows, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [provider]);

  if (error) return <p role="alert" className="text-red">{error}</p>;
  if (!rows) return <p role="status" className="text-text-2">Loading sources…</p>;
  const heads = ['Source', 'Label', 'Link', 'Licence / attribution', 'Last updated', 'Status'];
  return (
    <div className="overflow-x-auto card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-2">
            {heads.map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const st = STATUS[s.status];
            return (
              <tr key={s.id} className="border-b border-border align-top last:border-0">
                <td className="px-3 py-2"><div className="font-medium text-text">{s.name}</div><div className="text-xs text-text-2">{s.description}</div></td>
                <td className="px-3 py-2"><ProvenanceBadge label={s.label} /></td>
                <td className="px-3 py-2">
                  {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-verified-ink underline decoration-verified/50">{s.url}</a> : <span className="text-text-2">—</span>}
                </td>
                <td className="px-3 py-2 text-text">{s.licence}</td>
                <td className="tabular px-3 py-2 text-text">
                  {s.lastUpdated ? `${dateText(mytDate(s.lastUpdated))}, ${clock12(mytMinutes(s.lastUpdated))}` : '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm ${st.cls}`}>
                    <span aria-hidden="true">{st.icon}</span>{st.word}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
