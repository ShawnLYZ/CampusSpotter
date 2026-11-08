import { assert, assertEquals } from 'jsr:@std/assert@1';
import { handle } from './handler.ts';
import { assembleBundle, fetchBundleRows } from '../_shared/bundle.ts';
import { ENGINE_VERSION, runForecast } from '../_shared/engine.ts';
import { REPLAY_PLAN_4NOV } from '../_shared/plans.ts';
import { authedRequest, seededRepo } from '../_shared/testkit.ts';

const context = { date: '2026-11-04', disruptionId: 'weeknd-2026-11-04' };
const mk = () => { const repo = seededRepo(); return { repo, deps: { repo, now: () => new Date() } }; };
const bundle = assembleBundle(await fetchBundleRows(seededRepo().rows, context.date));

Deno.test('stores a forecast row matching a local engine run', async () => {
  const { repo, deps } = mk();
  const res = await handle(authedRequest({ context, levers: REPLAY_PLAN_4NOV }), deps);
  assertEquals(res.status, 200);
  const { id } = await res.json();
  const row = repo.tables.forecasts.find((r) => (r as { id: string }).id === id) as Record<string, unknown>;
  assert(row);
  const local = runForecast(bundle, REPLAY_PLAN_4NOV);
  assertEquals(row.engine_version, ENGINE_VERSION);
  assertEquals((row.summary as { peakApuWaitMin: number }).peakApuWaitMin, local.summary.peakApuWaitMin);
  assertEquals(row.scenario_kind, 'plan');
  assertEquals(row.created_by, '00000000-0000-0000-0000-000000000001');
  assertEquals(Object.keys(row.per_step as object).sort(), ['metrics', 'perBlock']);
  assertEquals(typeof row.input_snapshot_hash, 'string');
});

Deno.test('empty levers store a no_action row', async () => {
  const { repo, deps } = mk();
  assertEquals((await handle(authedRequest({ context, levers: [] }), deps)).status, 200);
  assertEquals((repo.tables.forecasts[0] as { scenario_kind: string }).scenario_kind, 'no_action');
});

Deno.test('rejects bad input and unauthenticated callers', async () => {
  const { deps } = mk();
  assertEquals((await handle(authedRequest({ context: {}, levers: [] }), deps)).status, 400);
  assertEquals((await handle(authedRequest({ context, levers: 'x' }), deps)).status, 400);
  assertEquals((await handle(authedRequest({ context, levers: [] }, null), deps)).status, 401);
});
