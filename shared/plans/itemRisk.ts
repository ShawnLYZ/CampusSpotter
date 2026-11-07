import type { MetricId, RiskLevel } from '../engine/types.ts';
import { runForecast, scoreRisk, topPeaks } from '../engine/index.ts';
import { addDays } from '../engine/grid.ts';
import type { DisruptionRow } from '../bundle/rows.ts';
import { assembleBundle, effectiveTimes, fetchBundleRows, mytParts } from '../bundle/assemble.ts';
import type { RowsClient } from '../bundle/assemble.ts';

export interface ItemRisk { level: RiskLevel; reason: string; peaks: { metric: MetricId; value: number; atMin: number }[] }

const ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const MAX_DAYS = 14;

/** Worst risk over the days of a disruption (at most 14, from its effective start); ties go to the earliest day. */
export async function itemRisk(client: RowsClient, row: DisruptionRow): Promise<ItemRisk> {
  const t = effectiveTimes(row);
  const first = mytParts(t.start_at).date;
  const last = mytParts(new Date(Math.max(Date.parse(t.start_at), Date.parse(t.end_at) - 1)).toISOString()).date;
  let best: ItemRisk | null = null;
  for (let i = 0, date = first; i < MAX_DAYS && date <= last; i++, date = addDays(date, 1)) {
    const bundle = assembleBundle(await fetchBundleRows(client, date), {});
    const f = runForecast(bundle, []);
    const risk = scoreRisk(f, bundle.settings);
    if (best === null || ORDER[risk.level] > ORDER[best.level]) {
      best = { level: risk.level, reason: risk.reason, peaks: topPeaks(f, bundle.settings, 3).map(({ metric, value, atMin }) => ({ metric, value, atMin })) };
    }
  }
  return best!;
}
