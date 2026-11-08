import { assert, assertEquals } from 'jsr:@std/assert@1';
import reply from '../../../shared/fixtures/recorded/gemini/plans-weeknd.json' with { type: 'json' };
import { handle } from './handler.ts';
import { assembleBundle, fetchBundleRows } from '../_shared/bundle.ts';
import { evaluatePlan } from '../_shared/engine.ts';
import { canonicalJson, sha256Hex } from '../_shared/hash.ts';
import { PROMPT_VERSION } from '../_shared/prompts.ts';
import { authedRequest, fakeGemini, seededRepo } from '../_shared/testkit.ts';

const context = { date: '2026-11-04', disruptionId: 'weeknd-2026-11-04' };
const body = (budgetRm = 2000) => ({ context, budgetRm });
const mk = (g: ReturnType<typeof fakeGemini>) => {
  const repo = seededRepo();
  return { repo, deps: { repo, gemini: g, apiKey: 'k', now: () => new Date('2026-11-04T01:00:00Z') } };
};
const bundle = assembleBundle(await fetchBundleRows(seededRepo().rows, context.date));

Deno.test('three plans are stored with engine-computed numbers', async () => {
  const { repo, deps } = mk(fakeGemini(reply));
  const res = await handle(authedRequest(body()), deps);
  assertEquals(res.status, 200);
  const { plans } = await res.json();
  assertEquals(plans.length, 3);
  assertEquals(new Set(plans.map((p: { id: string }) => p.id)).size, 3);
  for (let i = 0; i < 3; i++) {
    const row = await repo.getPlan(plans[i].id);
    assert(row, 'plan row stored');
    const ev = evaluatePlan(bundle, row.levers as never, 2000);
    assertEquals(row.total_cost_rm, ev.withPlan.summary.totalCostRm);
    assertEquals(row.cost_lines, ev.withPlan.summary.costLines);
    assertEquals(row.summary, ev.withPlan.summary);
    assertEquals(row.no_action_summary, ev.noAction.summary);
    assertEquals(row.over_budget, ev.overBudget);
    assertEquals(row.disruption_id, context.disruptionId);
    assertEquals(row.context_date, context.date);
    assertEquals(row.budget_rm, 2000);
    assertEquals(row.name, reply.plans[i].name);
    assertEquals(row.rationale, reply.plans[i].rationale);
    assertEquals(row.created_by, '00000000-0000-0000-0000-000000000001');
    assertEquals(plans[i].totalCostRm, ev.withPlan.summary.totalCostRm);
    assertEquals(plans[i].costLines, ev.withPlan.summary.costLines);
    assertEquals(plans[i].overBudget, ev.overBudget);
    assertEquals(plans[i].noActionSummary, ev.noAction.summary);
    assertEquals(plans[i].budgetRm, 2000);
  }
});

Deno.test('a plan whose levers cost RM 2,850 is over a RM 2,000 budget', async () => {
  const { deps } = mk(fakeGemini(reply));
  const { plans } = await (await handle(authedRequest(body(2000)), deps)).json();
  const independent = evaluatePlan(bundle, plans[0].levers, 2000);
  assertEquals(independent.withPlan.summary.totalCostRm, 2850);
  assertEquals(plans[0].totalCostRm, 2850);
  assert(plans[0].overBudget);
  assert(!plans[2].overBudget);
});

Deno.test('a repeated request is served from cache without Gemini or new rows', async () => {
  const g = fakeGemini(reply);
  const { deps } = mk(g);
  const first = await (await handle(authedRequest(body()), deps)).json();
  const second = await (await handle(authedRequest(body()), deps)).json();
  assertEquals(g.state.calls, 1);
  assertEquals(second, first); // same ids, so no new rows were inserted
});

Deno.test('plans cached without the engine version are not served: their numbers came from an older engine', async () => {
  const g = fakeGemini(reply);
  const { repo, deps } = mk(g);
  const inputHash = await sha256Hex(canonicalJson(bundle));
  const oldKey = await sha256Hex(canonicalJson({ fn: 'plans', promptVersion: PROMPT_VERSION, ...context, budgetRm: 2000, inputHash }));
  await repo.setCache(oldKey, 'plans', { plans: [], dropped: [] });
  const { plans } = await (await handle(authedRequest(body()), deps)).json();
  assertEquals(g.state.calls, 1);
  assertEquals(plans.length, 3);
});

Deno.test('a cache hit whose plan rows were deleted restores them without Gemini', async () => {
  const g = fakeGemini(reply);
  const { repo, deps } = mk(g);
  const first = await (await handle(authedRequest(body()), deps)).json();
  const kept = first.plans[0].id;
  repo.tables.plans = (repo.tables.plans as { id: string }[]).filter((p) => p.id === kept);

  const second = await (await handle(authedRequest(body()), deps)).json();
  assertEquals(g.state.calls, 1);
  assertEquals(second.plans[0].id, kept);
  assertEquals(second.dropped, first.dropped);
  for (let i = 0; i < 3; i++) {
    const row = await repo.getPlan(second.plans[i].id);
    assert(row, 'plan row exists again');
    assertEquals(row.name, first.plans[i].name);
    assertEquals(row.total_cost_rm, first.plans[i].totalCostRm);
    assertEquals(row.disruption_id, context.disruptionId);
  }
  assertEquals((repo.tables.plans as unknown[]).length, 3);

  const third = await (await handle(authedRequest(body()), deps)).json();
  assertEquals(third, second); // the healed ids are cached
  assertEquals(g.state.calls, 1);
});

Deno.test('a different budget is a different cache entry', async () => {
  const g = fakeGemini(reply);
  const { deps } = mk(g);
  await handle(authedRequest(body(2000)), deps);
  await handle(authedRequest(body(5000)), deps);
  assertEquals(g.state.calls, 2);
});

Deno.test('invalid budgets and missing context are 400', async () => {
  const { deps } = mk(fakeGemini(reply));
  for (const b of [0, -5, 100001, 'x', null]) {
    assertEquals((await handle(authedRequest({ context, budgetRm: b }), deps)).status, 400);
  }
  assertEquals((await handle(authedRequest({ budgetRm: 1000 }), deps)).status, 400);
});

Deno.test('unauthenticated is 401', async () => {
  const { deps } = mk(fakeGemini(reply));
  assertEquals((await handle(authedRequest(body(), null), deps)).status, 401);
});

Deno.test('different bundle inputs (reconstructed) are a different cache entry', async () => {
  const g = fakeGemini(reply);
  const { deps } = mk(g);
  await handle(authedRequest(body()), deps);
  await handle(authedRequest({ ...body(), context: { ...context, reconstructed: true } }), deps);
  assertEquals(g.state.calls, 2);
});

Deno.test('a changed input row is a cache miss', async () => {
  const g = fakeGemini(reply);
  const { repo, deps } = mk(g);
  await handle(authedRequest(body()), deps);
  const row = repo.tables.baseline_values[0] as { value: unknown };
  row.value = typeof row.value === 'number' ? row.value + 1 : row.value;
  await handle(authedRequest(body()), deps);
  assertEquals(g.state.calls, 2);
});

Deno.test('dropped counts (local and engine) are returned per plan, also from cache', async () => {
  const bad = structuredClone(reply) as typeof reply;
  Object.assign(bad.plans[1].levers, { teleport: [{}], extraBuses: [{ buses: 2, fromMin: 840, toMin: 840 }] });
  const g = fakeGemini(bad);
  const { deps } = mk(g);
  const first = await (await handle(authedRequest(body()), deps)).json();
  assertEquals(first.plans.length, 3);
  assertEquals(first.dropped, [0, 2, 0]);
  const second = await (await handle(authedRequest(body()), deps)).json();
  assertEquals(second, first);
});
