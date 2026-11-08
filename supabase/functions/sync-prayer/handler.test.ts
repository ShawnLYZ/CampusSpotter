import { assert, assertEquals } from 'jsr:@std/assert@1';
import sample from '../../../shared/fixtures/recorded/esolat-year-sample.json' with { type: 'json' };
import type { DisruptionRow, PrayerRow } from '../../../shared/bundle/rows.ts';
import { parseEsolatYear } from '../_shared/parsers.ts';
import { handle, PRAYER_URL } from './handler.ts';
import { SECRET_KEY, seededRepo, SECRET_KEYS, callerHeaders } from '../_shared/testkit.ts';

const req = (token: string | null = SECRET_KEY) =>
  new Request('http://localhost/sync-prayer', { method: 'POST', headers: callerHeaders(token) });
// Frozen clock: 2026-11-05T22:00:00Z = 06:00 MYT on Friday 6 Nov 2026 (today + 56 days = 31 Dec, the sample's last day).
const now = () => new Date('2026-11-05T22:00:00Z');
const okFetch = (body: unknown, calls: string[] = []) => ((url: string | URL | Request) => {
  calls.push(String(url));
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}) as typeof fetch;

Deno.test('stores prayer times from today and creates Friday items, the first starting 12:15', async () => {
  const repo = seededRepo();
  const calls: string[] = [];
  const res = await handle(req(), { repo, fetchFn: okFetch(sample, calls), now, secretKeys: SECRET_KEYS });
  assertEquals(res.status, 200);
  assertEquals(calls, [PRAYER_URL]);
  const prayers = repo.tables.prayer_times as PrayerRow[];
  assertEquals(prayers.find((p) => p.date === '2026-11-06' && p.zone === 'WLY01')!.dhuhr_min, 780);
  const items = (repo.tables.disruptions as DisruptionRow[]).filter((d) => d.id.startsWith('friday-prayer-2026-1'));
  const first = items.find((d) => d.id === 'friday-prayer-2026-11-06')!;
  assert(first);
  assertEquals(first.start_at, '2026-11-06T12:15:00+08:00');
  assertEquals(first.origin, 'rule');
  // Fridays 6, 13, 20, 27 Nov and 4, 11, 18, 25 Dec.
  assertEquals(items.filter((d) => d.start_at >= '2026-11-06' && d.start_at < '2027-01-01').length, 8);
  const j = await res.json();
  assertEquals(j.itemsChanged, 8);
  assertEquals((await repo.latestJob('sync-prayer'))?.status, 'success');
});

Deno.test('a Malay "Dis" date parses to December', () => {
  const rows = parseEsolatYear({ prayerTime: [{ date: '25-Dis-2026', fajr: '06:00:00', dhuhr: '13:00:00', asr: '16:00:00', maghrib: '19:00:00', isha: '20:00:00' }] }, '2026-11-06T00:00:00Z');
  assertEquals(rows[0].date, '2026-12-25');
  assert(sample.prayerTime.some((d) => d.date.includes('-Dis-')), 'recorded sample contains a Dis date');
});

Deno.test('a fetch failure leaves prayer rows and items unchanged', async () => {
  const repo = seededRepo();
  const before = JSON.stringify([repo.tables.prayer_times, repo.tables.disruptions]);
  const res = await handle(req(), { repo, fetchFn: (() => Promise.resolve(new Response('x', { status: 503 }))) as typeof fetch, now, secretKeys: SECRET_KEYS });
  assertEquals(res.status, 500);
  assertEquals(JSON.stringify([repo.tables.prayer_times, repo.tables.disruptions]), before);
});

Deno.test('an unknown month fails before any write', async () => {
  const repo = seededRepo();
  const before = JSON.stringify([repo.tables.prayer_times, repo.tables.disruptions]);
  const bad = { prayerTime: [{ date: '06-Xyz-2026', fajr: '1:00', dhuhr: '1:00', asr: '1:00', maghrib: '1:00', isha: '1:00' }] };
  const res = await handle(req(), { repo, fetchFn: okFetch(bad), now, secretKeys: SECRET_KEYS });
  assertEquals(res.status, 500);
  assertEquals(JSON.stringify([repo.tables.prayer_times, repo.tables.disruptions]), before);
});

Deno.test('rejects callers without the secret key', async () => {
  const repo = seededRepo();
  assertEquals((await handle(req(null), { repo, fetchFn: okFetch({}), now, secretKeys: SECRET_KEYS })).status, 401);
});

const ruleItem = (id: string, start: string, end: string, origin: DisruptionRow['origin'] = 'rule'): DisruptionRow => ({
  id, title: 'seeded', type: 'weekly_pattern', kind: 'friday_prayer', venue: null, start_at: start, end_at: end,
  expected_attendance: null, attendance_label: null, origin,
  override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
  status: 'active', risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null,
  notes: null, dedupe_key: null, created_by: null, updated_at: '2026-11-05T00:00:00+08:00',
});

Deno.test('valid-shaped but empty prayer data fails with schema and keeps existing rows and Friday items', async () => {
  const repo = seededRepo();
  (repo.tables.disruptions as DisruptionRow[]).push(ruleItem('friday-prayer-2026-11-13', '2026-11-13T12:15:00+08:00', '2026-11-13T14:45:00+08:00'));
  const before = JSON.stringify([repo.tables.prayer_times, repo.tables.disruptions]);
  const res = await handle(req(), { repo, fetchFn: okFetch({ prayerTime: [] }), now, secretKeys: SECRET_KEYS });
  assertEquals(res.status, 500);
  assertEquals(JSON.stringify([repo.tables.prayer_times, repo.tables.disruptions]), before);
  const run = (repo.tables.job_runs as { status: string; error_summary: string }[]).at(-1)!;
  assertEquals(run.status, 'failed');
  assert(run.error_summary.includes('schema'));
});

Deno.test('a removed Friday item has its date and neighbours risk-refreshed', async () => {
  const repo = seededRepo();
  const all = repo.tables.disruptions as DisruptionRow[];
  // Stale rule item on Wed 11 Nov (not a Friday in the new data) and a manual item on its +1 neighbour, Thu 12 Nov.
  all.push(ruleItem('friday-prayer-2026-11-11', '2026-11-11T12:15:00+08:00', '2026-11-11T14:45:00+08:00'));
  all.push({ ...ruleItem('manual-12-nov', '2026-11-12T09:00:00+08:00', '2026-11-12T12:00:00+08:00', 'manual'), kind: 'other', type: 'manual' });
  const res = await handle(req(), { repo, fetchFn: okFetch(sample), now, secretKeys: SECRET_KEYS });
  assertEquals(res.status, 200);
  const after = repo.tables.disruptions as DisruptionRow[];
  assert(!after.some((d) => d.id === 'friday-prayer-2026-11-11'));
  assert(after.find((d) => d.id === 'manual-12-nov')!.risk_level !== null, 'neighbour of the removed item refreshed');
});

Deno.test('a mid-December run never deletes rule items beyond the year file (cap at 1 Jan)', async () => {
  const repo = seededRepo();
  const all = repo.tables.disruptions as DisruptionRow[];
  all.push(ruleItem('friday-prayer-2027-01-08', '2027-01-08T12:15:00+08:00', '2027-01-08T14:45:00+08:00'));
  // 2026-12-15T22:00:00Z = 06:00 MYT Wed 16 Dec; today + 56 days is in February 2027, past the sample.
  const res = await handle(req(), { repo, fetchFn: okFetch(sample), now: () => new Date('2026-12-15T22:00:00Z'), secretKeys: SECRET_KEYS });
  assertEquals(res.status, 200);
  const after = repo.tables.disruptions as DisruptionRow[];
  assert(after.some((d) => d.id === 'friday-prayer-2027-01-08'));
  assert(after.some((d) => d.id === 'friday-prayer-2026-12-18'));
  assert(!after.some((d) => d.id === 'friday-prayer-2026-11-27'));
});
