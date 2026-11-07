import { useEffect, useState } from 'react';
import type { Settings } from '@engine/index.ts';
import { METRIC_IDS, METRIC_TITLES, METRIC_UNITS } from '@engine/index.ts';
import { useProvider } from '../../app/ProviderContext.tsx';
import { ProvenanceBadge } from '../../components/ProvenanceBadge.tsx';
import { rmText } from '../../lib/format.ts';
import type { BaselineTable } from '../../providers/types.ts';
import { riskRuleLines, t0Note, thresholdBands } from './rules.ts';

const th = 'px-3 py-2 font-medium';

export function RulesTab() {
  const provider = useProvider();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [google, setGoogle] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    provider.getSettings().then(setSettings, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    provider.listBaselineTables().then((ts: BaselineTable[]) => {
      const row = ts.find((t) => t.name === 'baseline_values')?.rows.find((r) => r.key === 'google_static_one_way_min');
      setGoogle(typeof row?.value === 'number' ? row.value : null);
    }, () => setGoogle(null));
  }, [provider]);

  if (error) return <p role="alert" className="text-red">{error}</p>;
  if (!settings) return <p role="status" className="text-text-2">Loading rules…</p>;
  const costs = [
    { name: 'Bus, one way', v: settings.busOneWayRm, text: rmText(settings.busOneWayRm.value) },
    { name: 'Bus, half day', v: settings.busHalfDayRm, text: rmText(settings.busHalfDayRm.value) },
    { name: 'Bus, full day', v: settings.busFullDayRm, text: rmText(settings.busFullDayRm.value) },
    { name: 'Staff rate per hour', v: settings.staffRatePerHourRm, text: rmText(settings.staffRatePerHourRm.value) },
    { name: 'Staff per counter', v: settings.staffPerCounter, text: String(settings.staffPerCounter.value) },
    { name: 'Peak tariff', v: settings.tariffPeakSenPerKwh, text: `${settings.tariffPeakSenPerKwh.value} sen/kWh` },
    { name: 'Off-peak tariff', v: settings.tariffOffPeakSenPerKwh, text: `${settings.tariffOffPeakSenPerKwh.value} sen/kWh` },
    { name: 'Default budget', v: settings.defaultBudgetRm, text: rmText(settings.defaultBudgetRm.value) },
  ];
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="h-thr">
        <h2 id="h-thr" className="mb-2 text-lg font-semibold text-text">Pressure thresholds</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-2">
                <th scope="col" className={th}>Metric</th>
                <th scope="col" className={th}>● Normal</th>
                <th scope="col" className={th}>▲ Busy</th>
                <th scope="col" className={th}>■ Overloaded</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_IDS.map((m) => {
                const b = thresholdBands(METRIC_UNITS[m], settings.thresholds[m]);
                return (
                  <tr key={m} className="border-b border-border last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-medium text-text">{METRIC_TITLES[m]}</th>
                    <td className="tabular px-3 py-2 text-text">{b.green}</td>
                    <td className="tabular px-3 py-2 text-text">{b.amber}</td>
                    <td className="tabular px-3 py-2 text-text">{b.red}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="h-risk">
        <h2 id="h-risk" className="mb-2 text-lg font-semibold text-text">Risk rules</h2>
        <p className="mb-2 text-sm text-text-2">The risk level comes from the no-action forecast for the day.</p>
        <dl className="space-y-2 rounded-lg border border-border bg-panel p-4 text-sm">
          {riskRuleLines(settings.risk).map((r) => (
            <div key={r.level} className="flex gap-3">
              <dt className="w-20 shrink-0 font-semibold text-text">{r.level}</dt>
              <dd className="text-text">{r.text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="h-cost">
        <h2 id="h-cost" className="mb-2 text-lg font-semibold text-text">Cost rates</h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-panel text-sm">
          {costs.map((c) => (
            <li key={c.name} className="flex items-center justify-between px-4 py-2">
              <span className="text-text">{c.name}</span>
              <span className="flex items-center gap-3"><span className="tabular text-text">{c.text}</span><ProvenanceBadge label={c.v.label} /></span>
            </li>
          ))}
        </ul>
      </section>
      {google !== null && <p className="text-sm text-text-2">{t0Note(google)}</p>}
    </div>
  );
}
