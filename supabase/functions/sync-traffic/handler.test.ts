import { assert, assertEquals } from 'jsr:@std/assert@1';
import sample from '../../../shared/fixtures/recorded/routes-sample.json' with { type: 'json' };
import type { DisruptionRow, TrafficRow } from '../../../shared/bundle/rows.ts';
import { handle, ROUTES_URL } from './handler.ts';
import { SECRET_KEY, seededRepo, SECRET_KEYS, callerHeaders } from '../_shared/testkit.ts';

type Repo = ReturnType<typeof seededRepo>;

const req = (token: string | null = SECRET_KEY) =>
  new Request('http://localhost/sync-traffic', { method: 'POST', headers: callerHeaders(token) });
// Frozen clock: 2026-11-17T22:00:00Z = 06:00 MYT on 18 Nov, before the 07:00 first departure.
const now = () => new Date('2026-11-17T22:00:00Z');
const FETCHED_AT = now().toISOString();
const MONTH = '2026-11';

interface Call { url: string; headers: Record<string, string>; body: Record<string, unknown> }
/** Fake Routes: the recorded sample for every call, except HTTP 500 from call number `failAt` on. */
function routesFetch(calls: Call[], failAt = Infinity) {
  return ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
    const bad = calls.length >= failAt;
    return Promise.resolve(new Response(bad ? 'secret upstream body' : JSON.stringify(sample), { status: bad ? 500 : 200 }));
  }) as typeof fetch;
}
const deps = (repo: Repo, fetchFn: typeof fetch) => ({ repo, fetchFn, now, routesKey: 'test-key', secretKeys: SECRET_KEYS });
const usage = (repo: Repo) =>
  (repo.tables.api_usage as { service: string; month: string; count: number }[]).find((r) => r.service === 'google_routes' && r.month === MONTH)?.count;
const fresh = (repo: Repo) => (repo.tables.traffic_cache as TrafficRow[]).filter((r) => r.kind === 'google' && r.fetched_at === FETCHED_AT);
const disruptions = (repo: Repo) => repo.tables.disruptions as DisruptionRow[];
const noRisk = (repo: Repo) => { for (const d of disruptions(repo)) d.risk_level = null; };

Deno.test('today only: 40 requests, 40 google rows, usage counted, request shape', async () => {
  const repo = seededRepo();
  noRisk(repo);
  const calls: Call[] = [];
  const res = await handle(req(), deps(repo, routesFetch(calls)));
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals([j.itemsFound, j.itemsChanged], [40, 40]);
  assertEquals(calls.length, 40);
  assertEquals(usage(repo), 40);
  assertEquals(calls[0].url, ROUTES_URL);
  assertEquals(calls[0].headers['X-Goog-FieldMask'], 'routes.duration,routes.staticDuration');
  assertEquals(calls[0].headers['X-Goog-Api-Key'], 'test-key');
  assertEquals(calls[0].body.routingPreference, 'TRAFFIC_AWARE');
  assertEquals(calls[0].body.departureTime, '2026-11-17T23:00:00Z');
  assertEquals(calls[0].body.travelMode, 'DRIVE');
  const apu = { latitude: 3.05607, longitude: 101.70047 };
  const lrt = { latitude: 3.05813, longitude: 101.69222 };
  assertEquals(calls[0].body.origin, { location: { latLng: apu } });
  assertEquals(calls[0].body.destination, { location: { latLng: lrt } });
  assertEquals(calls[1].body.origin, { location: { latLng: lrt } });
  const rows = fresh(repo);
  assertEquals(rows.length, 40);
  assertEquals([...new Set(rows.map((r) => r.date))], ['2026-11-18']);
  assertEquals([rows[0].duration_s, rows[0].static_duration_s], [668, 665]);
  assertEquals((await repo.latestJob('sync-traffic'))?.status, 'success');
});

Deno.test('a high-risk disruption within 30 days adds its date; low risk and later ones do not', async () => {
  const repo = seededRepo();
  noRisk(repo);
  const mk = (id: string, start: string, risk: DisruptionRow['risk_level']): DisruptionRow => ({
    id, title: id, type: 'manual', kind: 'other', venue: null, start_at: start, end_at: start,
    expected_attendance: null, attendance_label: null, origin: 'manual',
    override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
    status: 'active', risk_level: risk, risk_reason: null, risk_peaks: null, risk_computed_at: null,
    notes: null, dedupe_key: null, created_by: null, updated_at: '2026-11-01T00:00:00+08:00',
  });
  disruptions(repo).push(
    mk('a', '2026-11-20T19:00:00+08:00', 'high'),
    mk('b', '2026-11-20T10:00:00+08:00', 'critical'),
    mk('c', '2026-11-22T19:00:00+08:00', 'low'),
    mk('d', '2026-12-30T19:00:00+08:00', 'high'),
  );
  const calls: Call[] = [];
  await handle(req(), deps(repo, routesFetch(calls)));
  assertEquals([...new Set(fresh(repo).map((r) => r.date))].sort(), ['2026-11-18', '2026-11-20']);
  assertEquals(calls.length, 80);
});

Deno.test('cap reached mid-date: rows so far are kept, job failed with the cap message, later run makes no requests', async () => {
  const repo = seededRepo();
  noRisk(repo);
  (repo.tables.api_usage as unknown[]).push({ service: 'google_routes', month: MONTH, count: 3990 });
  const calls: Call[] = [];
  const res = await handle(req(), deps(repo, routesFetch(calls)));
  assertEquals(res.status, 500);
  assertEquals(calls.length, 10);
  assertEquals(fresh(repo).length, 10);
  const job = await repo.latestJob('sync-traffic');
  assertEquals(job?.status, 'failed');
  assertEquals(job?.errorSummary, 'traffic forecast paused (monthly cap)');

  const again: Call[] = [];
  await handle(req(), deps(repo, routesFetch(again)));
  assertEquals(again.length, 0);
  assertEquals((await repo.latestJob('sync-traffic'))?.errorSummary, 'traffic forecast paused (monthly cap)');
});

Deno.test('a non-OK Routes response saves earlier rows and fails without the response body', async () => {
  const repo = seededRepo();
  noRisk(repo);
  const res = await handle(req(), deps(repo, routesFetch([], 6)));
  assertEquals(res.status, 500);
  assertEquals(fresh(repo).length, 5);
  const job = await repo.latestJob('sync-traffic');
  assertEquals(job?.status, 'failed');
  assert(!String(job?.errorSummary).includes('secret'));
});

Deno.test('requires the secret key', async () => {
  const res = await handle(req(null), deps(seededRepo(), routesFetch([])));
  assertEquals(res.status, 401);
});

const riskyOn = (repo: Repo, date: string) =>
  disruptions(repo).push({
    id: `risky-${date}`, title: 'risky', type: 'manual', kind: 'other', venue: null, start_at: `${date}T19:00:00+08:00`, end_at: `${date}T22:00:00+08:00`,
    expected_attendance: null, attendance_label: null, origin: 'manual',
    override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
    status: 'active', risk_level: 'high', risk_reason: null, risk_peaks: null, risk_computed_at: null,
    notes: null, dedupe_key: null, created_by: null, updated_at: '2026-11-01T00:00:00+08:00',
  });
const cachedOn = (repo: Repo, date: string, fetchedAt: string) =>
  (repo.tables.traffic_cache as TrafficRow[]).push(
    { date, hour_index: 0, direction: 'apu_to_lrt', kind: 'google', duration_s: 600, static_duration_s: 600, fetched_at: fetchedAt },
  );
const fetchedDates = (calls: Call[]) => [...new Set(calls.map((c) => String(c.body.departureTime).slice(0, 10)))];

Deno.test('a risky date beyond today + 2 with google rows fetched in the last 3 days is skipped', async () => {
  const repo = seededRepo();
  noRisk(repo);
  riskyOn(repo, '2026-11-25');
  cachedOn(repo, '2026-11-25', '2026-11-16T22:00:00.000Z');
  const calls: Call[] = [];
  const res = await handle(req(), deps(repo, routesFetch(calls)));
  assertEquals(res.status, 200);
  assertEquals(calls.length, 40);
  assertEquals([...new Set(fresh(repo).map((r) => r.date))], ['2026-11-18']);
});

Deno.test('a fresh-cached risky date within today + 2 is still fetched', async () => {
  const repo = seededRepo();
  noRisk(repo);
  riskyOn(repo, '2026-11-20');
  cachedOn(repo, '2026-11-20', '2026-11-17T20:00:00.000Z');
  const calls: Call[] = [];
  await handle(req(), deps(repo, routesFetch(calls)));
  assertEquals(calls.length, 80);
  assertEquals([...new Set(fresh(repo).map((r) => r.date))].sort(), ['2026-11-18', '2026-11-20']);
});

Deno.test('a risky date whose google rows are older than 3 days is fetched again', async () => {
  const repo = seededRepo();
  noRisk(repo);
  riskyOn(repo, '2026-11-25');
  cachedOn(repo, '2026-11-25', '2026-11-14T21:00:00.000Z');
  const calls: Call[] = [];
  await handle(req(), deps(repo, routesFetch(calls)));
  assertEquals(calls.length, 80);
  assert(fetchedDates(calls).includes('2026-11-25'));
});

Deno.test('rows are saved after each date, before the next date is fetched', async () => {
  const repo = seededRepo();
  noRisk(repo);
  riskyOn(repo, '2026-11-25');
  const savedAtSecondDate: number[] = [];
  const inner = routesFetch([]);
  let n = 0;
  const fetchFn = ((url: string | URL | Request, init?: RequestInit) => {
    if (++n === 41) savedAtSecondDate.push(fresh(repo).length);
    return inner(url, init);
  }) as typeof fetch;
  await handle(req(), deps(repo, fetchFn));
  assertEquals(savedAtSecondDate, [40]);
});
