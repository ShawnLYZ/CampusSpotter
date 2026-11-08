import { assertEquals, assert } from 'jsr:@std/assert@1';
import { createMemoryRepo } from './repo.ts';
import { FINISH_FAILED_MESSAGE, requireServiceRole, runJob } from './jobs.ts';
import type { DisruptionRow } from '../../../shared/bundle/rows.ts';

const row = (over: Partial<DisruptionRow>): DisruptionRow => ({
  id: 'x', title: 'T', type: 'manual', kind: 'other', venue: null, start_at: '2026-11-12T10:00:00+08:00', end_at: '2026-11-12T12:00:00+08:00',
  expected_attendance: null, attendance_label: null, origin: 'manual',
  override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
  status: 'active', risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null,
  notes: null, dedupe_key: null, created_by: null, updated_at: '2026-11-05T00:00:00+08:00', ...over,
});

const jwt = (payload: unknown) => `h.${btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}.s`;
const reqWith = (auth?: string) => new Request('http://localhost/fn', { headers: auth ? { Authorization: auth } : {} });

Deno.test('runJob records a failed run with the error text and returns 500', async () => {
  const repo = createMemoryRepo();
  const res = await runJob(repo, 'sync-x', () => Promise.reject(new Error('boom')));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, 'boom');
  const job = await repo.latestJob('sync-x');
  assertEquals(job?.status, 'failed');
  assertEquals(job?.errorSummary, 'boom');
  assertEquals(job?.id, body.jobRunId);
});

Deno.test('runJob truncates the error summary to 300 characters', async () => {
  const repo = createMemoryRepo();
  await runJob(repo, 'sync-x', () => Promise.reject(new Error('e'.repeat(500))));
  assertEquals((await repo.latestJob('sync-x'))?.errorSummary?.length, 300);
});

Deno.test('runJob records counts on success and returns 200 with the result', async () => {
  const repo = createMemoryRepo();
  const res = await runJob(repo, 'sync-x', () => Promise.resolve({ itemsFound: 7, itemsChanged: 3, method: 'api' }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals([body.itemsFound, body.itemsChanged, body.method], [7, 3, 'api']);
  const job = await repo.latestJob('sync-x');
  assertEquals([job?.status, job?.itemsFound, job?.itemsChanged, job?.method, job?.errorSummary], ['success', 7, 3, 'api', null]);
  assertEquals(job?.id, body.jobRunId);
});

Deno.test('requireServiceRole accepts only a service_role JWT', () => {
  assert(requireServiceRole(reqWith(`Bearer ${jwt({ role: 'service_role' })}`)));
  assert(!requireServiceRole(reqWith(`Bearer ${jwt({ role: 'authenticated' })}`)));
  assert(!requireServiceRole(reqWith()));
  assert(!requireServiceRole(reqWith('Bearer garbage')));
  assert(!requireServiceRole(reqWith('Bearer a.!!!.c')));
  assert(!requireServiceRole(reqWith(`Bearer h.${btoa('not json')}.s`)));
});

Deno.test('upsertScannedDisruption keeps overrides and dismissal, updates title and sources', async () => {
  const repo = createMemoryRepo();
  const first = row({ id: 'scan-1', origin: 'scan', title: 'BTS World Tour KL', dedupe_key: 'k1' });
  assertEquals(await repo.upsertScannedDisruption(first, [{ disruption_id: 'scan-1', url: 'https://a', title: 'a', published_at: null, fetched_at: '2026-11-05T00:00:00Z' }]), 'inserted');
  const stored = (repo.tables.disruptions as DisruptionRow[])[0];
  Object.assign(stored, { override_attendance: 9999, status: 'dismissed' });
  const again = row({ id: 'scan-other', origin: 'scan', title: 'BTS Kuala Lumpur 2026', dedupe_key: 'k1' });
  assertEquals(await repo.upsertScannedDisruption(again, [{ disruption_id: 'scan-other', url: 'https://b', title: 'b', published_at: null, fetched_at: '2026-11-06T00:00:00Z' }]), 'updated');
  const list = repo.tables.disruptions as DisruptionRow[];
  assertEquals(list.length, 1);
  assertEquals([list[0].id, list[0].title, list[0].override_attendance, list[0].status, list[0].origin], ['scan-1', 'BTS Kuala Lumpur 2026', 9999, 'dismissed', 'scan']);
  const sources = repo.tables.disruption_sources as { disruption_id: string; url: string }[];
  assertEquals(sources.map((s) => `${s.disruption_id} ${s.url}`).sort(), ['scan-1 https://a', 'scan-1 https://b']);
  assertEquals(await repo.upsertScannedDisruption(again, []), 'unchanged');
});

Deno.test('upsertRuleDisruptions deletes stale rule rows in the window but never manual, scan or out-of-window rows', async () => {
  const rain = (d: string, over: Partial<DisruptionRow> = {}) =>
    row({ id: `heavy-rain-${d}`, kind: 'heavy_rain', type: 'weather', origin: 'rule', start_at: `${d}T10:00:00+08:00`, end_at: `${d}T12:00:00+08:00`, ...over });
  const repo = createMemoryRepo({
    disruptions: [
      rain('2026-11-12'), rain('2026-11-30'),
      row({ id: 'manual-1', kind: 'heavy_rain', origin: 'manual' }),
      row({ id: 'scan-1', kind: 'heavy_rain', origin: 'scan', start_at: '2026-11-13T10:00:00+08:00', end_at: '2026-11-13T11:00:00+08:00' }),
    ],
  } as never);
  const res = await repo.upsertRuleDisruptions('heavy_rain', [rain('2026-11-10')], { fromIso: '2026-11-10T00:00:00+08:00', toIso: '2026-11-25T00:00:00+08:00' });
  assertEquals(res, { inserted: 1, updated: 0, deleted: 1 });
  const ids = (repo.tables.disruptions as DisruptionRow[]).map((r) => r.id).sort();
  assertEquals(ids, ['heavy-rain-2026-11-10', 'heavy-rain-2026-11-30', 'manual-1', 'scan-1']);
});

Deno.test('api usage increments and insertMissingRooms keeps existing rooms', async () => {
  const repo = createMemoryRepo();
  assertEquals(await repo.incrementApiUsage('google_routes', '2026-11', 2), 2);
  assertEquals(await repo.incrementApiUsage('google_routes', '2026-11', 1), 3);
  const room = { code: 'A-1', block: 'A', level: null, room_type: 'classroom', seats: 30, seats_label: 'verified' };
  await repo.insertMissingRooms([room as never]);
  await repo.insertMissingRooms([{ ...room, seats: 99 } as never]);
  assertEquals((repo.tables.rooms as { seats: number }[]).map((r) => r.seats), [30]);
});

Deno.test('upsertPrayer replaces by date and zone', async () => {
  const repo = createMemoryRepo();
  const p = { date: '2026-11-10', zone: 'SGR01', fajr_min: 1, dhuhr_min: 2, asr_min: 3, maghrib_min: 4, isha_min: 5, fetched_at: 'x' };
  await repo.upsertPrayer([p]);
  assertEquals(await repo.upsertPrayer([{ ...p, fajr_min: 9 }]), 1);
  assertEquals((repo.tables.prayer_times as { fajr_min: number }[]).map((r) => r.fajr_min), [9]);
});

Deno.test('replaceTimetable swaps only the given dates', async () => {
  const repo = createMemoryRepo({ timetable_days: [{ date: '2026-11-10', sessions: 1 }, { date: '2026-11-11', sessions: 2 }] } as never);
  await repo.replaceTimetable(['2026-11-10'], [{ date: '2026-11-10', sessions: 5, label: 'verified', synced_at: 'x' }], [], []);
  const days = (repo.tables.timetable_days as { date: string; sessions: number }[]).map((r) => `${r.date}:${r.sessions}`).sort();
  assertEquals(days, ['2026-11-10:5', '2026-11-11:2']);
});

Deno.test('replaceTimetable with a smaller set removes stale group rows and keeps other dates', async () => {
  const g = (date: string, start_min: number) => ({ date, block: 'A', room_type: 'classroom', start_min, end_min: start_min + 60, count: 1, first_of_day_share: 0, last_of_day_share: 0 });
  const repo = createMemoryRepo({ timetable_groups: [g('2026-11-10', 480), g('2026-11-10', 540), g('2026-11-11', 480)] } as never);
  await repo.replaceTimetable(['2026-11-10'], [], [{ ...g('2026-11-10', 480), count: 7 }] as never, []);
  const groups = repo.tables.timetable_groups as { date: string; start_min: number; count: number }[];
  assertEquals(groups.map((r) => `${r.date}:${r.start_min}:${r.count}`).sort(), ['2026-11-10:480:7', '2026-11-11:480:1']);
});

Deno.test('listDisruptions filters by window, origin, kind and status', async () => {
  const repo = createMemoryRepo({
    disruptions: [
      row({ id: 'a' }), row({ id: 'b', origin: 'scan' }), row({ id: 'c', status: 'dismissed' }),
      row({ id: 'd', start_at: '2027-01-01T00:00:00+08:00', end_at: '2027-01-01T01:00:00+08:00' }),
    ],
  } as never);
  const w = { fromIso: '2026-11-01T00:00:00+08:00', toIso: '2026-12-01T00:00:00+08:00' };
  assertEquals((await repo.listDisruptions(w)).map((r) => r.id).sort(), ['a', 'b']);
  assertEquals((await repo.listDisruptions({ ...w, origins: ['scan'] })).map((r) => r.id), ['b']);
  assertEquals((await repo.listDisruptions({ ...w, includeDismissed: true })).length, 3);
  assertEquals((await repo.listDisruptions({ ...w, kinds: ['concert'] })).length, 0);
});

type RunRow = { id: number; job_name: string; started_at: string; finished_at: string | null; status: string; error_summary: string | null };
const runningRow = (id: number, minutesAgo: number, job_name = 'sync-x'): RunRow => ({
  id, job_name, started_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(), finished_at: null, status: 'running', error_summary: null,
});

Deno.test('runJob closes a running row older than 10 minutes as interrupted, but not a fresh one or another job', async () => {
  const repo = createMemoryRepo({ job_runs: [runningRow(1, 11), runningRow(2, 5), runningRow(3, 30, 'sync-y')] } as never);
  await runJob(repo, 'sync-x', () => Promise.resolve({ itemsFound: 0, itemsChanged: 0 }));
  const runs = repo.tables.job_runs as RunRow[];
  const byId = (id: number) => runs.find((r) => r.id === id)!;
  assertEquals([byId(1).status, byId(1).error_summary], ['failed', 'interrupted']);
  assert(byId(1).finished_at !== null);
  assertEquals([byId(2).status, byId(2).finished_at], ['running', null]);
  assertEquals(byId(3).status, 'running');
  assertEquals(await repo.failStaleJobs('sync-x', new Date(Date.now() - 600_000).toISOString()), 0);
});

Deno.test('a finishJob failure in the catch path still returns the original error', async () => {
  const repo = createMemoryRepo();
  repo.finishJob = () => Promise.reject(new Error('db down'));
  const res = await runJob(repo, 'sync-x', () => Promise.reject(new Error('boom')));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, 'boom');
});

Deno.test('a finishJob failure after a successful run returns 500 with a fixed message', async () => {
  const repo = createMemoryRepo();
  repo.finishJob = () => Promise.reject(new Error('db down: secret detail'));
  const res = await runJob(repo, 'sync-x', () => Promise.resolve({ itemsFound: 1, itemsChanged: 1 }));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, FINISH_FAILED_MESSAGE);
});

Deno.test('a successful run with a note records it as the error summary and returns it once as note', async () => {
  const repo = createMemoryRepo();
  const res = await runJob(repo, 'sync-x', () => Promise.resolve({ itemsFound: 2, itemsChanged: 1, note: `estimates failed 2${' x'.repeat(200)}` }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assert(body.note.startsWith('estimates failed 2'));
  assertEquals(Object.keys(body).filter((k) => k === 'note' || k === 'errorSummary'), ['note']);
  const job = await repo.latestJob('sync-x');
  assertEquals(job?.status, 'success');
  assertEquals(job?.errorSummary, body.note.slice(0, 300));
});

Deno.test('a rescan keeps the notes of an existing scan row and does not count them as a change', async () => {
  const repo = createMemoryRepo();
  await repo.upsertScannedDisruption(row({ id: 'scan-1', origin: 'scan', title: 'BTS', dedupe_key: 'k1' }), []);
  (repo.tables.disruptions as DisruptionRow[])[0].notes = 'Manager: extra buses booked';
  assertEquals(await repo.upsertScannedDisruption(row({ id: 'scan-1', origin: 'scan', title: 'BTS', dedupe_key: 'k1', notes: null }), []), 'unchanged');
  assertEquals(await repo.upsertScannedDisruption(row({ id: 'scan-1', origin: 'scan', title: 'BTS KL', dedupe_key: 'k1', notes: null }), []), 'updated');
  const stored = (repo.tables.disruptions as DisruptionRow[])[0];
  assertEquals([stored.title, stored.notes], ['BTS KL', 'Manager: extra buses booked']);
});
