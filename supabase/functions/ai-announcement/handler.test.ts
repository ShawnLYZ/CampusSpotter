import { assert, assertEquals } from 'jsr:@std/assert@1';
import ok from '../../../shared/fixtures/recorded/gemini/announcement-ok.json' with { type: 'json' };
import long from '../../../shared/fixtures/recorded/gemini/announcement-long.json' with { type: 'json' };
import { handle } from './handler.ts';
import { assembleBundle, fetchBundleRows } from '../_shared/bundle.ts';
import { evaluatePlan } from '../_shared/engine.ts';
import { GeminiError } from '../_shared/gemini.ts';
import { buildChecklist, REPLAY_PLAN_4NOV } from '../_shared/plans.ts';
import type { PlanProposal } from '../_shared/api.ts';
import { authedRequest, fakeGemini, seededRepo } from '../_shared/testkit.ts';

const bundle = assembleBundle(await fetchBundleRows(seededRepo().rows, '2026-11-04'));
const ev = evaluatePlan(bundle, REPLAY_PLAN_4NOV, 2000);
const plan: PlanProposal = {
  id: 'p1', name: 'Replay', levers: REPLAY_PLAN_4NOV, rationale: 'Spread demand.', costLines: ev.withPlan.summary.costLines,
  totalCostRm: ev.withPlan.summary.totalCostRm, summary: ev.withPlan.summary, noActionSummary: ev.noAction.summary,
  overBudget: ev.overBudget, budgetRm: 2000,
};
const body = { plan, context: { date: '2026-11-04' }, checklist: buildChecklist(REPLAY_PLAN_4NOV, bundle) };
const mk = (g: ReturnType<typeof fakeGemini>) => ({ repo: seededRepo(), gemini: g, apiKey: 'k', now: () => new Date() });
const words = (t: string) => t.trim().split(/\s+/).length;

Deno.test('recorded fixtures: ok is under 150 words, long is 180', () => {
  assert(words(ok.draft) < 150);
  assertEquals(words(long.draft), 180);
});

Deno.test('a compliant draft returns 200 { draft } after one call', async () => {
  const g = fakeGemini(ok);
  const res = await handle(authedRequest(body), mk(g));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { draft: ok.draft });
  assertEquals(g.state.calls, 1);
});

Deno.test('a too-long draft is retried once with feedback (two Gemini calls)', async () => {
  const g = fakeGemini(long, ok);
  const res = await handle(authedRequest(body), mk(g));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).draft, ok.draft);
  assertEquals(g.state.calls, 2);
  assert(g.state.prompts[1].includes('rejected'));
});

Deno.test('two bad drafts give 502', async () => {
  const g = fakeGemini(long);
  assertEquals((await handle(authedRequest(body), mk(g))).status, 502);
  assertEquals(g.state.calls, 2);
});

Deno.test('wrong opening or closing is rejected and retried', async () => {
  const noOpen = { draft: ok.draft.replace('Dear students,', 'Hello all,') };
  const noClose = { draft: ok.draft.replace('— APU Management', '- APU') };
  for (const bad of [noOpen, noClose]) {
    const g = fakeGemini(bad, ok);
    const res = await handle(authedRequest(body), mk(g));
    assertEquals(res.status, 200);
    assertEquals(g.state.calls, 2);
  }
});

Deno.test('trailing whitespace is tolerated', async () => {
  const g = fakeGemini({ draft: `${ok.draft}\n  ` });
  assertEquals((await handle(authedRequest(body), mk(g))).status, 200);
  assertEquals(g.state.calls, 1);
});

Deno.test('Gemini outage is 503; bad body is 400', async () => {
  assertEquals((await handle(authedRequest(body), mk(fakeGemini(new GeminiError('http', 'down'))))).status, 503);
  assertEquals((await handle(authedRequest({ ...body, plan: null }), mk(fakeGemini(ok)))).status, 400);
  assertEquals((await handle(authedRequest({ ...body, checklist: 'x' }), mk(fakeGemini(ok)))).status, 400);
});

Deno.test('both passes share one request deadline', async () => {
  const g = fakeGemini(long, ok);
  await handle(authedRequest(body), mk(g));
  assertEquals(g.state.deadlines.length, 2);
  assertEquals(typeof g.state.deadlines[0], 'number');
  assertEquals(g.state.deadlines[0], g.state.deadlines[1]);
});
