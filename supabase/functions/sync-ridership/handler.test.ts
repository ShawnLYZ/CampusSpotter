import { assert, assertEquals } from 'jsr:@std/assert@1';
import type { RidershipRow } from '../../../shared/bundle/rows.ts';
import { handle } from './handler.ts';
import type { ParquetLib } from './parquet.ts';
import { SERVICE_TOKEN, seededRepo } from '../_shared/testkit.ts';

type Repo = ReturnType<typeof seededRepo>;

const req = (token: string | null = SERVICE_TOKEN) =>
  new Request('http://localhost/sync-ridership', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
const now = () => new Date('2026-11-07T04:00:00Z'); // 12:00 MYT, year 2026
const BJ = 'SP17: Bukit Jalil';
const ALL = 'A0: All Stations';

const group = (numRows: number, originMin: string, originMax: string) => ({
  num_rows: BigInt(numRows),
  columns: [
    { meta_data: { path_in_schema: ['origin'], statistics: { min_value: originMin, max_value: originMax } } },
    { meta_data: { path_in_schema: ['destination'], statistics: { min_value: 'A0: All Stations', max_value: 'SP99' } } },
  ],
});

/** Three row groups (100 rows each); only the middle one covers SP17: Bukit Jalil. */
function stubLib(reads: { rowStart?: number; rowEnd?: number; url?: string }[], days: number, matching = true): ParquetLib {
  const mid = matching ? group(100, 'SP10', 'SP20') : group(100, 'KA01', 'KJ99');
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.UTC(2026, 0, 1 + i));
    rows.push({ origin: BJ, destination: ALL, date, ridership: 100 + i });
    rows.push({ origin: ALL, destination: BJ, date, ridership: 50 + i });
  }
  return {
    asyncBufferFromUrl: ({ url }: { url: string }) => { reads.push({ url }); return Promise.resolve({ byteLength: 0 }); },
    parquetMetadataAsync: () => Promise.resolve({ row_groups: [group(100, 'KA01', 'KJ99'), mid, group(100, 'SP30', 'SP99')] }),
    parquetReadObjects: (o: { rowStart?: number; rowEnd?: number }) => { reads.push({ rowStart: o.rowStart, rowEnd: o.rowEnd }); return Promise.resolve(rows); },
    compressors: {},
  } as unknown as ParquetLib;
}
const deps = (repo: Repo, lib: ParquetLib) => ({ repo, now, lib });
const ridership = (repo: Repo) => repo.tables.lrt_ridership_daily as RidershipRow[];

Deno.test('reads only the matching row group and upserts station daily rows', async () => {
  const repo = seededRepo();
  const reads: { rowStart?: number; rowEnd?: number; url?: string }[] = [];
  const res = await handle(req(), deps(repo, stubLib(reads, 40)));
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals([j.itemsFound, j.itemsChanged], [40, 40]);
  assertEquals(reads[0].url, 'https://storage.data.gov.my/transportation/rail/rapidrail_2026_daily.parquet');
  assertEquals(reads.slice(1), [{ rowStart: 100, rowEnd: 200 }]);
  const row = ridership(repo).find((r) => r.date === '2026-01-03' && r.station === BJ);
  assertEquals([row?.boardings, row?.alightings], [102, 52]);
  assertEquals((await repo.latestJob('sync-ridership'))?.status, 'success');
});

Deno.test('no matching row group fails before any read and keeps existing rows', async () => {
  const repo = seededRepo();
  const before = structuredClone(ridership(repo));
  const reads: { rowStart?: number; rowEnd?: number; url?: string }[] = [];
  const res = await handle(req(), deps(repo, stubLib(reads, 40, false)));
  assertEquals(res.status, 500);
  assertEquals(reads.filter((r) => r.rowStart !== undefined), []);
  const job = await repo.latestJob('sync-ridership');
  assertEquals(job?.status, 'failed');
  assert(String(job?.errorSummary).includes('no row groups'));
  assertEquals(ridership(repo), before);
});

Deno.test('fewer than 30 dates fails and keeps existing rows', async () => {
  const repo = seededRepo();
  const before = structuredClone(ridership(repo));
  const res = await handle(req(), deps(repo, stubLib([], 10)));
  assertEquals(res.status, 500);
  const job = await repo.latestJob('sync-ridership');
  assertEquals(job?.status, 'failed');
  assert(String(job?.errorSummary).includes('too few dates'));
  assertEquals(ridership(repo), before);
});

Deno.test('requires the service role', async () => {
  const res = await handle(req(null), deps(seededRepo(), stubLib([], 40)));
  assertEquals(res.status, 401);
});
