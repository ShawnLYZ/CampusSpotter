import { assert, assertEquals } from 'jsr:@std/assert@1';
import ok from '../../../shared/fixtures/recorded/gemini/explain-ok.json' with { type: 'json' };
import invented from '../../../shared/fixtures/recorded/gemini/explain-invented.json' with { type: 'json' };
import { handle } from './handler.ts';
import { assembleBundle, fetchBundleRows } from '../_shared/bundle.ts';
import { evaluatePlan } from '../_shared/engine.ts';
import type { Summary } from '../_shared/engine.ts';
import { factsSheet, numbersOutside } from '../_shared/facts.ts';
import { REPLAY_PLAN_4NOV } from '../_shared/plans.ts';
import { authedRequest, fakeGemini, seededRepo } from '../_shared/testkit.ts';

const repo0 = seededRepo();
const evaluation = evaluatePlan(assembleBundle(await fetchBundleRows(repo0.rows, '2026-11-04'), { reconstructed: true }), REPLAY_PLAN_4NOV, 100000);
const noAction = evaluation.noAction.summary;
const withPlan = evaluation.withPlan.summary;
const body = () => ({ context: { date: '2026-11-04' }, levers: REPLAY_PLAN_4NOV, noAction, withPlan });
const mk = (g: ReturnType<typeof fakeGemini>) => {
  const repo = seededRepo();
  return { repo, deps: { repo, gemini: g, apiKey: 'k', now: () => new Date('2026-11-04T01:00:00Z') } };
};

Deno.test('factsSheet states the APU peak wait with its time and allows those numbers', () => {
  const s: Summary = { ...noAction, peakApuWaitMin: 230, peakApuQueue: { value: 230, atMin: 1095 } };
  const { text, allowedNumbers } = factsSheet(s, withPlan, REPLAY_PLAN_4NOV);
  assert(text.includes('Peak APU stop wait (no action): 3 h 50 min at 6:15 PM'), text);
  for (const n of ['3', '50', '6', '15']) assert(allowedNumbers.has(n), n);
  assert(text.includes('Peak LRT stop wait (with plan)'));
  for (const c of withPlan.costLines) assert(text.includes(c.text));
});

Deno.test('numbersOutside removes thousands commas and lists strangers once', () => {
  assertEquals(numbersOutside('RM 1,200 and 97% and 97 and 5.5', new Set(['1200', '5.5'])), ['97']);
});

Deno.test('a clean explanation returns 200 and is cached', async () => {
  const g = fakeGemini(ok);
  const { repo, deps } = mk(g);
  const res = await handle(authedRequest(body()), deps);
  assertEquals(res.status, 200);
  assertEquals((await res.json()).text, ok.text);
  assert(g.state.prompts[0].startsWith('Facts:\n'));
  const again = await handle(authedRequest(body()), deps);
  assertEquals(again.status, 200);
  assertEquals(g.state.calls, 1);
  assertEquals(repo.tables.ai_cache.length, 1);
});

Deno.test('an invented number fails twice with 502, retry names it, nothing cached', async () => {
  const g = fakeGemini(invented);
  const { repo, deps } = mk(g);
  const res = await handle(authedRequest(body()), deps);
  assertEquals(res.status, 502);
  assertEquals((await res.json()).error, 'explanation cited numbers not in the input');
  assertEquals(g.state.calls, 2);
  assert(g.state.prompts[1].includes('97'));
  assertEquals(repo.tables.ai_cache.length, 0);
});

Deno.test('a first invented reply is corrected by the retry', async () => {
  const g = fakeGemini(invented, ok);
  const { deps } = mk(g);
  const res = await handle(authedRequest(body()), deps);
  assertEquals(res.status, 200);
  assertEquals(g.state.calls, 2);
});

Deno.test('validation and auth', async () => {
  const { deps } = mk(fakeGemini(ok));
  assertEquals((await handle(authedRequest(body(), null), deps)).status, 401);
  assertEquals((await handle(authedRequest({ ...body(), withPlan: null }), deps)).status, 400);
  assertEquals((await handle(authedRequest({ ...body(), levers: 'x' }), deps)).status, 400);
});

Deno.test('both passes share one request deadline', async () => {
  const g = fakeGemini(invented, ok);
  const { deps } = mk(g);
  await handle(authedRequest(body()), deps);
  assertEquals(g.state.deadlines.length, 2);
  assertEquals(typeof g.state.deadlines[0], 'number');
  assertEquals(g.state.deadlines[0], g.state.deadlines[1]);
});
