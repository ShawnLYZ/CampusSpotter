import { assert, assertEquals } from 'jsr:@std/assert@1';
import weeknd from '../../../shared/fixtures/recorded/gemini/estimate-weeknd.json' with { type: 'json' };
import oob from '../../../shared/fixtures/recorded/gemini/estimate-out-of-bounds.json' with { type: 'json' };
import { handle } from './handler.ts';
import { GeminiError } from '../_shared/gemini.ts';
import { authedRequest, fakeGemini, seededRepo } from '../_shared/testkit.ts';
import type { EstimateRow } from '../_shared/bundle.ts';

const ID = 'weeknd-2026-11-04';
const body = { date: '2026-11-04', disruptionId: ID };
const mk = (gemini: ReturnType<typeof fakeGemini>) => {
  const repo = seededRepo();
  const before = new Set((repo.tables.ai_estimates as EstimateRow[]).map((r) => r.context_hash));
  return { repo, before, deps: { repo, gemini, apiKey: 'k', now: () => new Date('2026-11-04T01:00:00Z') } };
};
const added = (repo: ReturnType<typeof seededRepo>, before: Set<string>) =>
  (repo.tables.ai_estimates as EstimateRow[]).filter((r) => !before.has(r.context_hash));

Deno.test('stores 7 rows, then serves the second call from the cache', async () => {
  const g = fakeGemini(weeknd);
  const { repo, before, deps } = mk(g);
  const r1 = await handle(authedRequest(body), deps);
  assertEquals(r1.status, 200);
  const j1 = await r1.json();
  assertEquals(j1.estimates.length, 7);
  assertEquals(j1.cached, false);
  assertEquals(j1.missing, []);
  assert('disruptionId' in j1.estimates[0] && 'createdAt' in j1.estimates[0]);
  assertEquals(added(repo, before).length, 7);
  const j2 = await (await handle(authedRequest(body), deps)).json();
  assertEquals(j2.cached, true);
  assertEquals(j2.estimates.length, 7);
  assertEquals(g.state.calls, 1);
});

Deno.test('out-of-bounds values are clamped and flagged', async () => {
  const { repo, before, deps } = mk(fakeGemini(oob));
  assertEquals((await handle(authedRequest(body), deps)).status, 200);
  const row = added(repo, before).find((r) => r.key === 'eventLrtModeShare')!;
  assertEquals(row.likely, 0.8);
  assertEquals(row.high, 0.8);
  assertEquals(row.clamped, true);
  assertEquals(row.model, 'gemini-3.5-flash-lite');
  assert((row.low as number) <= (row.likely as number));
});

Deno.test('keys missing from the reply are reported', async () => {
  const partial = { estimates: weeknd.estimates.slice(0, 5) };
  const { deps } = mk(fakeGemini(partial));
  const j = await (await handle(authedRequest(body), deps)).json();
  assertEquals(j.estimates.length, 5);
  assertEquals(j.missing, ['dinnerStayShare', 'advisoryCompliance']);
});

Deno.test('a Gemini 429 gives 503 stale with the previously stored estimates', async () => {
  const { repo, deps } = mk(fakeGemini(new GeminiError('rate_limited', 'slow down', 429)));
  const prev = await repo.latestEstimatesFor(ID);
  assert(prev.length > 0);
  const res = await handle(authedRequest(body), deps);
  assertEquals(res.status, 503);
  const j = await res.json();
  assertEquals(j.stale, true);
  assertEquals(
    j.estimates.map((e: { key: string; likely: unknown }) => [e.key, e.likely]).sort(),
    prev.map((r) => [r.key, r.likely]).sort(),
  );
});

Deno.test('a network failure surfaces as 503 stale', async () => {
  const { deps } = mk(fakeGemini(new GeminiError('http', 'network error calling Gemini')));
  const res = await handle(authedRequest(body), deps);
  assertEquals(res.status, 503);
  assertEquals((await res.json()).stale, true);
});

Deno.test('no Authorization header gives 401; unknown token gives 401', async () => {
  const g = fakeGemini(weeknd);
  const { deps } = mk(g);
  assertEquals((await handle(authedRequest(body, null), deps)).status, 401);
  assertEquals((await handle(authedRequest(body, 'nope'), deps)).status, 401);
  assertEquals(g.state.calls, 0);
});

Deno.test('preflight, bad JSON, bad input and unknown disruption', async () => {
  const { deps } = mk(fakeGemini(weeknd));
  const pre = await handle(new Request('http://x', { method: 'OPTIONS' }), deps);
  assertEquals(pre.status, 200);
  assertEquals(pre.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
  const bad = new Request('http://x', { method: 'POST', headers: { Authorization: 'Bearer tok-manager' }, body: '{nope' });
  assertEquals((await handle(bad, deps)).status, 400);
  assertEquals((await handle(authedRequest({ date: 5 }), deps)).status, 400);
  assertEquals((await handle(authedRequest({ date: '2026-11-04', disruptionId: 'ghost' }), deps)).status, 404);
});

Deno.test('a disruption without estimate keys returns empty without calling Gemini', async () => {
  const g = fakeGemini(weeknd);
  const { deps } = mk(g);
  const res = await handle(authedRequest({ date: '2026-12-25', disruptionId: 'yearend-break-2026' }), deps);
  assertEquals(res.status, 200);
  assertEquals((await res.json()).estimates, []);
  assertEquals(g.state.calls, 0);
});
