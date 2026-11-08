import { assertEquals, assert } from 'jsr:@std/assert@1';
import { createMemoryRepo } from './repo.ts';
import { getCaller } from './auth.ts';

const plan = {
  context_date: '2026-11-04', disruption_id: 'd1', name: 'Plan A', levers: [], rationale: 'r', cost_lines: [], total_cost_rm: 1,
  summary: {}, no_action_summary: {}, budget_rm: 10, over_budget: false,
};

Deno.test('insertPlans then getPlan round-trips', async () => {
  const repo = createMemoryRepo();
  const [{ id }] = await repo.insertPlans([plan]);
  const got = await repo.getPlan(id);
  assertEquals(got?.name, 'Plan A');
  assertEquals(await repo.getPlan('missing'), null);
});

Deno.test('setCache then getCache round-trips', async () => {
  const repo = createMemoryRepo();
  assertEquals(await repo.getCache('h'), null);
  await repo.setCache('h', 'fn', { a: 1 });
  assertEquals(await repo.getCache('h'), { a: 1 });
});

Deno.test('rows.select filters', async () => {
  const repo = createMemoryRepo({ disruptions: [{ id: 'a', status: 'active' }, { id: 'b', status: 'dismissed' }] });
  const out = await repo.rows.select('disruptions', [{ column: 'status', op: 'eq', value: 'active' }]);
  assertEquals(out, [{ id: 'a', status: 'active' }]);
});

Deno.test('roleOf returns the seeded role and getCaller resolves a bearer token', async () => {
  const repo = createMemoryRepo({}, { tok: { id: 'u1', role: 'manager' } });
  assertEquals(await repo.roleOf('u1'), 'manager');
  assertEquals(await repo.roleOf('nobody'), null);
  const ok = await getCaller(new Request('http://x', { headers: { Authorization: 'Bearer tok' } }), repo);
  assertEquals(ok, { userId: 'u1', role: 'manager' });
  assertEquals(await getCaller(new Request('http://x'), repo), null);
  assertEquals(await getCaller(new Request('http://x', { headers: { Authorization: 'Bearer bad' } }), repo), null);
});

Deno.test('deleteDecision removes the decision with its checklist and announcement', async () => {
  const repo = createMemoryRepo();
  const d = await repo.insertDecision({ plan_id: null, forecast_id: null, disruption_id: null, context_date: '2026-11-04', plan_name: 'P', levers: [], predicted: {}, total_cost_rm: 0 });
  const other = await repo.insertDecision({ plan_id: null, forecast_id: null, disruption_id: null, context_date: '2026-11-04', plan_name: 'Q', levers: [], predicted: {}, total_cost_rm: 0 });
  await repo.insertChecklist([{ decision_id: d.id, team: 'transport', text: 't', due_at: null, sort: 0 }, { decision_id: other.id, team: 'academic', text: 'a', due_at: null, sort: 0 }]);
  await repo.insertAnnouncement({ decision_id: d.id, draft: 'x' });
  await repo.deleteDecision(d.id);
  assertEquals(repo.tables.decisions.length, 1);
  assertEquals(repo.tables.checklist_items.length, 1);
  assertEquals(repo.tables.announcements.length, 0);
  assert(repo.tables.decisions.length === 1);
});

Deno.test('latestEstimatesFor returns only the newest context_hash group', async () => {
  const mk = (h: string, key: string, at: string) => ({ context_hash: h, disruption_id: 'd1', key, created_at: at });
  const repo = createMemoryRepo({ ai_estimates: [mk('old', 'k1', '2026-01-01'), mk('new', 'k1', '2026-02-01'), mk('new', 'k2', '2026-02-01')] } as never);
  assertEquals((await repo.latestEstimatesFor('d1')).length, 2);
  assertEquals((await repo.getEstimatesByHash('old')).length, 1);
});
