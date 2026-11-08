import { assert, assertEquals } from 'jsr:@std/assert@1';
import sample from '../../../shared/fixtures/recorded/timetable-feed-sample.json' with { type: 'json' };
import { handle, FEED_URL } from './handler.ts';
import { roleToken, SECRET_KEY, seededRepo, SECRET_KEYS, callerHeaders } from '../_shared/testkit.ts';

const req = (token: string | null = SECRET_KEY) =>
  new Request('http://localhost/sync-timetable', { method: 'POST', headers: callerHeaders(token) });
const feed = (body: unknown, calls: string[] = []) => (url: string | URL | Request) => {
  calls.push(String(url));
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
};
const now = () => new Date('2026-11-08T21:00:00Z');

Deno.test('stores counts-only groups for both dates and never leaks personal fields', async () => {
  const repo = seededRepo();
  const calls: string[] = [];
  const logs: unknown[][] = [];
  const origLog = console.log, origErr = console.error;
  console.log = (...a) => { logs.push(a); };
  console.error = (...a) => { logs.push(a); };
  let res: Response;
  try {
    res = await handle(req(), { repo, fetchFn: feed(sample, calls) as typeof fetch, now, secretKeys: SECRET_KEYS });
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  assertEquals(res.status, 200);
  assertEquals(calls, [FEED_URL]);
  const j = await res.json();
  assertEquals(j.itemsFound, 10);
  assertEquals(j.itemsChanged, 2);
  const groups = repo.tables.timetable_groups as { date: string }[];
  const dates = new Set(groups.filter((g) => g.date >= '2026-11-09' && g.date <= '2026-11-10').map((g) => g.date));
  assertEquals([...dates].sort(), ['2026-11-09', '2026-11-10']);
  const dump = JSON.stringify({ tables: repo.tables, logs });
  for (const s of ['Test Lecturer', 'L999', 'tl999', 'UCDF2401', 'UCDF2402']) assert(!dump.includes(s), s);
  assertEquals((await repo.latestJob('sync-timetable'))?.status, 'success');
});

Deno.test('a feed with a changed shape fails with schema and keeps the old rows', async () => {
  const repo = seededRepo();
  const before = JSON.stringify([repo.tables.timetable_days, repo.tables.timetable_groups, repo.tables.timetable_conditioned]);
  const res = await handle(req(), { repo, fetchFn: feed([{ ROOM: 'A' }]) as typeof fetch, now, secretKeys: SECRET_KEYS });
  assertEquals(res.status, 500);
  assertEquals(JSON.stringify([repo.tables.timetable_days, repo.tables.timetable_groups, repo.tables.timetable_conditioned]), before);
  const run = (repo.tables.job_runs as { status: string; error_summary: string }[]).at(-1)!;
  assertEquals(run.status, 'failed');
  assert(run.error_summary.includes('schema'));
});

Deno.test('rejects callers without the secret key, including a forged legacy service_role token', async () => {
  const repo = seededRepo();
  let fetched = false;
  const fetchFn = (() => { fetched = true; return Promise.resolve(new Response('[]')); }) as typeof fetch;
  const run = (r: Request) => handle(r, { repo, fetchFn, now, secretKeys: SECRET_KEYS }).then((res) => res.status);
  assertEquals(await run(req(null)), 401);
  assertEquals(await run(req(roleToken('authenticated'))), 401);
  assertEquals(await run(req(roleToken('service_role'))), 401);
  assertEquals(await run(req('sb_secret_not-the-project-key')), 401);
  const onBearer = new Request('http://localhost/sync-timetable', { method: 'POST', headers: { Authorization: `Bearer ${SECRET_KEY}` } });
  assertEquals(await run(onBearer), 401);
  assertEquals(fetched, false);
});
