import { assert, assertEquals } from 'jsr:@std/assert@1';
import sample from '../../../shared/fixtures/recorded/open-meteo-sample.json' with { type: 'json' };
import type { DisruptionRow } from '../../../shared/bundle/rows.ts';
import { handle, WEATHER_URL } from './handler.ts';
import { SECRET_KEY, seededRepo, SECRET_KEYS, callerHeaders } from '../_shared/testkit.ts';

const req = (token: string | null = SECRET_KEY) =>
  new Request('http://localhost/sync-weather', { method: 'POST', headers: callerHeaders(token) });
// Frozen clock: 2026-11-05T22:00:00Z = 06:00 MYT on 6 Nov, so 6 Nov and 10 Nov both sit inside the rain window.
const now = () => new Date('2026-11-05T22:00:00Z');

/** The recorded sample with every hour dry, except 14:00 on each of `rainyDates` (8 mm, 90 %). */
function forecast(rainyDates: string[]) {
  const hourly = structuredClone(sample.hourly);
  const wet = (t: string) => rainyDates.some((d) => t === `${d}T14:00`);
  hourly.precipitation = hourly.time.map((t) => (wet(t) ? 8 : 0));
  hourly.precipitation_probability = hourly.time.map((t) => (wet(t) ? 90 : 5));
  return { ...sample, hourly };
}
const okFetch = (body: unknown, calls: string[] = []) => ((url: string | URL | Request) => {
  calls.push(String(url));
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}) as typeof fetch;

const manualOn10Nov = (): DisruptionRow => ({
  id: 'manual-10-nov', title: 'Open day', type: 'manual', kind: 'other', venue: null,
  start_at: '2026-11-10T09:00:00+08:00', end_at: '2026-11-10T12:00:00+08:00',
  expected_attendance: null, attendance_label: null, origin: 'manual',
  override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
  status: 'active', risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null,
  notes: null, dedupe_key: null, created_by: null, updated_at: '2026-11-05T00:00:00+08:00',
});
const disruptions = (repo: ReturnType<typeof seededRepo>) => repo.tables.disruptions as DisruptionRow[];

Deno.test('a qualifying rain hour creates the rule item, and a dry rerun removes it but keeps the manual item', async () => {
  const repo = seededRepo();
  disruptions(repo).push(manualOn10Nov());
  const calls: string[] = [];
  const res = await handle(req(), { repo, fetchFn: okFetch(forecast(['2026-11-10']), calls), now, secretKeys: SECRET_KEYS });
  assertEquals(res.status, 200);
  assertEquals(calls, [WEATHER_URL]);
  const j = await res.json();
  assertEquals(j.itemsFound, sample.hourly.time.length);
  assertEquals(j.itemsChanged, 1);
  const rain = disruptions(repo).find((d) => d.id === 'heavy-rain-2026-11-10')!;
  assert(rain);
  assertEquals(rain.origin, 'rule');
  assertEquals(rain.start_at, '2026-11-10T14:00:00+08:00');
  assert(rain.risk_level !== null, 'risk refreshed for the new item');
  assert(disruptions(repo).find((d) => d.id === 'manual-10-nov')!.risk_level !== null, 'same-day manual item refreshed');
  assertEquals((await repo.latestJob('sync-weather'))?.status, 'success');

  const dry = await handle(req(), { repo, fetchFn: okFetch(forecast([])), now, secretKeys: SECRET_KEYS });
  assertEquals((await dry.json()).itemsChanged, 1);
  assert(!disruptions(repo).some((d) => d.id === 'heavy-rain-2026-11-10'));
  assert(disruptions(repo).some((d) => d.id === 'manual-10-nov'));
});

Deno.test('rain hours before today (MYT) do not make items', async () => {
  const repo = seededRepo();
  await handle(req(), { repo, fetchFn: okFetch(forecast(['2026-11-05'])), now, secretKeys: SECRET_KEYS });
  assert(!disruptions(repo).some((d) => d.id === 'heavy-rain-2026-11-05'));
});

Deno.test("today's rain item survives a later run of the day, after its rain hour has passed", async () => {
  const repo = seededRepo();
  const wet = okFetch(forecast(['2026-11-06']));
  await handle(req(), { repo, fetchFn: wet, now, secretKeys: SECRET_KEYS });
  assert(disruptions(repo).some((d) => d.id === 'heavy-rain-2026-11-06'));
  // 16:00 MYT on 6 Nov: the 14:00 rain hour is past, but today's item is kept.
  const later = () => new Date('2026-11-06T08:00:00Z');
  const res = await handle(req(), { repo, fetchFn: wet, now: later, secretKeys: SECRET_KEYS });
  assertEquals(res.status, 200);
  const rain = disruptions(repo).find((d) => d.id === 'heavy-rain-2026-11-06');
  assertEquals(rain?.start_at, '2026-11-06T14:00:00+08:00');
});

Deno.test('a fetch 500 fails the job and leaves the weather rows unchanged', async () => {
  const repo = seededRepo();
  const before = JSON.stringify([repo.tables.weather_hourly, repo.tables.disruptions]);
  const res = await handle(req(), { repo, fetchFn: (() => Promise.resolve(new Response('boom', { status: 500 }))) as typeof fetch, now, secretKeys: SECRET_KEYS });
  assertEquals(res.status, 500);
  assertEquals(JSON.stringify([repo.tables.weather_hourly, repo.tables.disruptions]), before);
  assertEquals((await repo.latestJob('sync-weather'))?.status, 'failed');
});

Deno.test('an unparseable body fails before any write', async () => {
  const repo = seededRepo();
  const before = JSON.stringify([repo.tables.weather_hourly, repo.tables.disruptions]);
  const res = await handle(req(), { repo, fetchFn: okFetch({ nope: 1 }), now, secretKeys: SECRET_KEYS });
  assertEquals(res.status, 500);
  assertEquals(JSON.stringify([repo.tables.weather_hourly, repo.tables.disruptions]), before);
});

Deno.test('rejects callers without the secret key', async () => {
  const repo = seededRepo();
  assertEquals((await handle(req(null), { repo, fetchFn: okFetch({}), now, secretKeys: SECRET_KEYS })).status, 401);
});

Deno.test('a valid-shaped but empty forecast fails with schema and keeps existing rows and rule items', async () => {
  const repo = seededRepo();
  await handle(req(), { repo, fetchFn: okFetch(forecast(['2026-11-10'])), now, secretKeys: SECRET_KEYS });
  const before = JSON.stringify([repo.tables.weather_hourly, repo.tables.disruptions]);
  const empty = { hourly: { time: [], precipitation: [], precipitation_probability: [] } };
  const res = await handle(req(), { repo, fetchFn: okFetch(empty), now, secretKeys: SECRET_KEYS });
  assertEquals(res.status, 500);
  assertEquals(JSON.stringify([repo.tables.weather_hourly, repo.tables.disruptions]), before);
  const run = (repo.tables.job_runs as { status: string; error_summary: string }[]).at(-1)!;
  assertEquals(run.status, 'failed');
  assert(run.error_summary.includes('schema'));
});
