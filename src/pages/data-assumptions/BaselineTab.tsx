import { useCallback, useEffect, useRef, useState } from 'react';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useSubscription } from '../../hooks/useSubscription.ts';
import { Toast } from '../../components/Toast.tsx';
import type { BaselineTable, CsvReport } from '../../providers/types.ts';
import { cellText, displayColumns, reportLines } from './csvReport.ts';

const btn = 'btn';

function Section({ table }: { table: BaselineTable }) {
  const provider = useProvider();
  const [verified, setVerified] = useState(false);
  const [report, setReport] = useState<CsvReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cols = displayColumns(table.name, table.columns);
  const lines = report ? reportLines(report) : [];

  const download = async () => {
    try {
      const csv = await provider.getCsvTemplate(table.name);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${table.name}_template.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setToast(e instanceof Error ? e.message : 'Could not download the template'); }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      setReport(await provider.uploadBaselineCsv(table.name, text, { markVerified: verified }));
    } catch (e) {
      setReport({ ok: false, applied: false, rowCount: 0, errors: [{ row: 1, column: null, message: e instanceof Error ? e.message : 'Upload failed' }] });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const inputId = `upload-${table.name}`;
  return (
    <section aria-labelledby={`h-${table.name}`} className="card p-4">
      <h2 id={`h-${table.name}`} className="mb-3 text-lg font-medium text-text">{table.title}</h2>
      <div className="max-h-72 overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-panel-2">
            <tr className="text-left text-text-2">{cols.map((c) => <th key={c.header} scope="col" className="px-3 py-1.5 font-medium">{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {cols.map((c) => <td key={c.header} className="tabular px-3 py-1.5 text-text">{cellText(r[c.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => void download()} className={btn}>Download CSV template</button>
        <label htmlFor={inputId} className="text-sm text-text">Upload CSV</label>
        <input id={inputId} ref={fileRef} type="file" accept=".csv,text/csv" disabled={busy}
          onChange={(e) => void upload(e.target.files?.[0])}
          className="text-sm text-text-2 file:mr-3 file:rounded-lg file:border file:border-border-strong file:bg-panel-2 file:text-text file:px-3 file:py-1.5 file:text-text" />
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="h-4 w-4 accent-verified" />
          Mark as Verified APU data
        </label>
      </div>
      <div aria-live="polite" className="mt-3">
        {report && (
          <div className={`rounded-md border p-3 text-sm ${report.errors.length === 0 ? 'border-verified text-text' : 'border-red text-text'}`}>
            {report.errors.length === 0
              ? <p>{lines[0]}</p>
              : (
                <>
                  <p className="mb-1 font-medium">Nothing was applied. Fix these rows and upload again.</p>
                  <ul className="list-disc pl-5">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </>
              )}
          </div>
        )}
      </div>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </section>
  );
}

export function BaselineTab() {
  const provider = useProvider();
  const [tables, setTables] = useState<BaselineTable[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    provider.listBaselineTables().then(setTables, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [provider]);
  useEffect(load, [load]);
  useSubscription('baseline', load);

  if (error) return <p role="alert" className="text-red">{error}</p>;
  if (!tables) return <p role="status" className="text-text-2">Loading baseline tables…</p>;
  return <div className="flex flex-col gap-4">{tables.map((t) => <Section key={t.name} table={t} />)}</div>;
}
