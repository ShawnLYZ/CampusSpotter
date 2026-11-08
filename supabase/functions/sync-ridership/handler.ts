import { mytParts } from '../../../shared/bundle/assemble.ts';
import { fail } from '../_shared/http.ts';
import { requireSecretKey, runJob } from '../_shared/jobs.ts';
import { BUKIT_JALIL, stationDailyFromOd } from '../_shared/parsers.ts';
import type { Repo } from '../_shared/repo.ts';
import { readStationRows } from './parquet.ts';
import type { ParquetLib } from './parquet.ts';

export interface SyncRidershipDeps { repo: Repo; now: () => Date; lib: ParquetLib; secretKeys: readonly string[] }

const MIN_DATES = 30;

/** Updates LRT Bukit Jalil daily ridership from the yearly rapid-rail Parquet file (range reads only). */
export async function handle(req: Request, deps: SyncRidershipDeps): Promise<Response> {
  if (!requireSecretKey(req, deps.secretKeys)) return fail(401, 'secret key required');
  const { repo, now, lib } = deps;
  return runJob(repo, 'sync-ridership', async () => {
    const yearMyt = mytParts(now().toISOString()).date.slice(0, 4);
    const url = `https://storage.data.gov.my/transportation/rail/rapidrail_${yearMyt}_daily.parquet`;
    const rows = stationDailyFromOd(await readStationRows(url, BUKIT_JALIL, lib), BUKIT_JALIL);
    if (rows.filter((r) => r.date.startsWith(yearMyt)).length < MIN_DATES) throw new Error('ridership: too few dates');
    const changed = await repo.upsertRidership(rows);
    return { itemsFound: rows.length, itemsChanged: changed };
  });
}
