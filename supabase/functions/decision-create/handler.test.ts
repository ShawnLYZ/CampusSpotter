import { assert, assertEquals } from 'jsr:@std/assert@1';
import { handle } from './handler.ts';
import { assembleBundle, fetchBundleRows } from '../_shared/bundle.ts';
import { buildChecklist, REPLAY_PLAN_4NOV } from '../_shared/plans.ts';
import { authedRequest, seededRepo } from '../_shared/testkit.ts';

const context = { date: '2026-11-04', disruptionId: 'weeknd-2026-11-04' };
const bundle = assembleBundle(await fetchBundleRows(seededRepo().rows, context.date));

async function withPlan(date = context.date) {
  const repo = seededRepo();
  const [{ id }] = await repo.insertPlans([{
    context_date: date, disruption_id: context.disruptionId, name: 'Replay plan', levers: REPLAY_PLAN_4NOV, rationale: 'r',
    cost_lines: [], total_cost_rm: 0, summary: {}, no_action_summary: {}, budget_rm: 5000, over_budget: false,
  }]);
  return { repo, planId: id };
}
const counts = (repo: { tables: Record<string, unknown[]> }) =>
  ['forecasts', 'decisions', 'checklist_items', 'announcements'].map((n) => repo.tables[n].length);
const body = (planId: string) => ({ planId, context, notes: 'n', announcementText: 'Classes move online.' });

Deno.test('creates decision, checklist covering every team, and announcement', async () => {
  const { repo, planId } = await withPlan();
  const res = await handle(authedRequest(body(planId)), { repo, now: () => new Date() });
  assertEquals(res.status, 200);
  const out = await res.json();
  assertEquals(out.decision.planId, planId);
  assertEquals(out.decision.contextDate, context.date);
  assertEquals(out.decision.status, 'planned');
  assertEquals(out.decision.notes, 'n');
  assertEquals(out.decision.decidedBy, '00000000-0000-0000-0000-000000000001');
  assert(out.decision.forecastId);
  assertEquals(out.announcement.draft, 'Classes move online.');
  assertEquals(out.announcement.decisionId, out.decision.id);
  const drafts = buildChecklist(REPLAY_PLAN_4NOV, bundle);
  assertEquals(out.checklist.length, drafts.length);
  assertEquals(new Set(out.checklist.map((c: { team: string }) => c.team)), new Set(drafts.map((d) => d.team)));
  assert(out.checklist.every((c: { decisionId: string }) => c.decisionId === out.decision.id));
  assertEquals(counts(repo), [1, 1, drafts.length, 1]);
  const sorts = (repo.tables.checklist_items as { sort: number }[]).map((c) => c.sort);
  assertEquals(sorts, drafts.map((_, i) => i));
});

Deno.test('unknown plan returns 404 and writes nothing', async () => {
  const { repo } = await withPlan();
  const res = await handle(authedRequest(body(crypto.randomUUID())), { repo, now: () => new Date() });
  assertEquals(res.status, 404);
  assertEquals(counts(repo), [0, 0, 0, 0]);
});

Deno.test('context date mismatch returns 400 and writes nothing', async () => {
  const { repo, planId } = await withPlan('2026-11-05');
  const res = await handle(authedRequest(body(planId)), { repo, now: () => new Date() });
  assertEquals(res.status, 400);
  assertEquals(counts(repo), [0, 0, 0, 0]);
});

Deno.test('a failed checklist insert rolls the decision back and returns 500', async () => {
  const { repo, planId } = await withPlan();
  const broken = { ...repo, insertChecklist: () => Promise.reject(new Error('boom')) };
  const res = await handle(authedRequest(body(planId)), { repo: broken, now: () => new Date() });
  assertEquals(res.status, 500);
  assertEquals(repo.tables.decisions.length, 0);
  assertEquals(repo.tables.checklist_items.length, 0);
  assertEquals(repo.tables.announcements.length, 0);
});

Deno.test('a failed announcement insert also removes the checklist', async () => {
  const { repo, planId } = await withPlan();
  const broken = { ...repo, insertAnnouncement: () => Promise.reject(new Error('boom')) };
  const res = await handle(authedRequest(body(planId)), { repo: broken, now: () => new Date() });
  assertEquals(res.status, 500);
  assertEquals(counts(repo).slice(1), [0, 0, 0]);
});

Deno.test('a context disruptionId that differs from the plan is 400 before any write', async () => {
  const { repo, planId } = await withPlan();
  const before = counts(repo);
  const res = await handle(
    authedRequest({ ...body(planId), context: { ...context, disruptionId: 'some-other-disruption' } }),
    { repo, now: () => new Date() },
  );
  assertEquals(res.status, 400);
  assertEquals(counts(repo), before);
});

Deno.test('with no context disruptionId, forecast and decision both use the plan disruption', async () => {
  const { repo, planId } = await withPlan();
  const res = await handle(
    authedRequest({ ...body(planId), context: { date: context.date } }),
    { repo, now: () => new Date() },
  );
  assertEquals(res.status, 200);
  const out = await res.json();
  assertEquals(out.decision.disruptionId, context.disruptionId);
  const f = repo.tables.forecasts[0] as { disruption_id: string | null };
  assertEquals(f.disruption_id, context.disruptionId);
});
