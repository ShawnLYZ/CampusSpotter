import type { Repo } from './repo.ts';
import { itemRisk } from './plans.ts';
import { addDays } from '../../../shared/engine/grid.ts';
import { effectiveTimes, mytParts, overlapsDate } from '../../../shared/bundle/assemble.ts';

const HORIZON_DAYS = 120;

/** Recomputes the risk of active disruptions starting in [today, today + 120 days], limited to `ids` or to items overlapping `dates`. Returns the count. */
export async function refreshRisks(repo: Repo, opts: { today: string; ids?: string[]; dates?: string[] }): Promise<number> {
  const items = await repo.listDisruptions({
    fromIso: `${opts.today}T00:00:00+08:00`,
    toIso: `${addDays(opts.today, HORIZON_DAYS + 1)}T00:00:00+08:00`,
  });
  const ids = opts.ids ? new Set(opts.ids) : null;
  const selected = items.filter((r) =>
    (!ids || ids.has(r.id)) && (!opts.dates || opts.dates.some((d) => overlapsDate(effectiveTimes(r), d))));
  for (const row of selected) {
    const risk = await itemRisk(repo.rows, row);
    await repo.updateRisk(row.id, { level: risk.level, reason: risk.reason, peaks: risk.peaks, computedAt: new Date().toISOString() });
  }
  return selected.length;
}

/** Dates whose risk needs a refresh after a rule-item sync: dates of the new rows plus dates of old rule rows that were removed, each with its neighbours (+-1 day), sorted and deduplicated. */
export function ruleRefreshDates(before: { id: string; start_at: string }[], rows: { id: string; start_at: string }[]): string[] {
  const keep = new Set(rows.map((r) => r.id));
  const changed = [...rows, ...before.filter((b) => !keep.has(b.id))].map((r) => mytParts(r.start_at).date);
  const dates = new Set<string>();
  for (const d of changed) for (const n of [-1, 0, 1]) dates.add(addDays(d, n));
  return [...dates].sort();
}
