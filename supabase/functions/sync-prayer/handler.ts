import { mytParts } from '../../../shared/bundle/assemble.ts';
import { fridayPrayerRows } from '../../../shared/bundle/rules.ts';
import { addDays } from '../../../shared/engine/grid.ts';
import { fail } from '../_shared/http.ts';
import { requireSecretKey, runJob } from '../_shared/jobs.ts';
import { parseEsolatYear } from '../_shared/parsers.ts';
import type { Repo } from '../_shared/repo.ts';
import { refreshRisks, ruleRefreshDates } from '../_shared/risk.ts';

export const PRAYER_URL = 'https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone=WLY01';

export interface SyncPrayerDeps { repo: Repo; fetchFn: typeof fetch; now: () => Date; secretKeys: readonly string[] }

const FRIDAY_DAYS = 56;
const minDate = (a: string, b: string): string => (a < b ? a : b);

/** Refreshes the year's prayer times (today onwards) and regenerates the Friday-prayer rule items for the next 56 days. */
export async function handle(req: Request, deps: SyncPrayerDeps): Promise<Response> {
  if (!requireSecretKey(req, deps.secretKeys)) return fail(401, 'secret key required');
  const { repo, fetchFn, now } = deps;
  return runJob(repo, 'sync-prayer', async () => {
    const res = await fetchFn(PRAYER_URL);
    if (!res.ok) throw new Error(`e-solat: HTTP ${res.status}`);
    const fetchedAt = now();
    let all;
    try {
      all = parseEsolatYear(await res.json(), fetchedAt.toISOString());
    } catch (e) {
      throw new Error(`schema: e-solat response could not be parsed (${(e as Error).message})`);
    }
    const today = mytParts(fetchedAt.toISOString()).date;
    const yearEnd = `${today.slice(0, 4)}-12-31`;
    const prayers = all.filter((p) => p.date >= today && p.date <= yearEnd);
    if (prayers.length === 0) throw new Error('schema: e-solat returned no prayer times from today to year end');
    const last = addDays(today, FRIDAY_DAYS);
    const rows = fridayPrayerRows(prayers, today, last);
    const window = { fromIso: `${today}T00:00:00+08:00`, toIso: `${minDate(addDays(last, 1), `${Number(today.slice(0, 4)) + 1}-01-01`)}T00:00:00+08:00` };

    const before = await repo.listDisruptions({ ...window, includeDismissed: true, origins: ['rule'], kinds: ['friday_prayer'] });

    await repo.upsertPrayer(prayers);
    const counts = await repo.upsertRuleDisruptions('friday_prayer', rows, window);
    const dates = ruleRefreshDates(before, rows);
    if (dates.length > 0) await refreshRisks(repo, { today, dates });

    return { itemsFound: prayers.length, itemsChanged: counts.inserted + counts.updated + counts.deleted };
  });
}
