import { assert, assertEquals } from 'jsr:@std/assert@1';
import afternoon from '../../../shared/fixtures/recorded/gemini/ask-afternoon.json' with { type: 'json' };
import badLever from '../../../shared/fixtures/recorded/gemini/ask-bad-lever.json' with { type: 'json' };
import { handle } from './handler.ts';
import { GeminiError } from '../_shared/gemini.ts';
import { SYSTEM_PROMPTS } from '../_shared/prompts.ts';
import { authedRequest, fakeGemini, seededRepo } from '../_shared/testkit.ts';

const body = (extra: object = {}) => ({
  question: 'Move afternoon classes online and add buses',
  context: { date: '2026-11-04', disruptionId: 'weeknd-2026-11-04' },
  levers: [],
  ...extra,
});
const mk = (g: ReturnType<typeof fakeGemini>) => {
  const repo = seededRepo();
  return { repo, deps: { repo, gemini: g, apiKey: 'k', now: () => new Date('2026-11-04T01:00:00Z') } };
};

Deno.test('afternoon question gives two levers and the changed kinds', async () => {
  const g = fakeGemini(afternoon);
  const { deps } = mk(g);
  const res = await handle(authedRequest(body()), deps);
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.matched, true);
  assertEquals(j.levers.length, 2);
  assertEquals(j.changedKinds, ['classesOnline', 'extraBuses']);
  assertEquals(j.dropped, 0);
  assert(j.restatement.length > 0);
  assert(g.state.prompts[0].includes('classesOnline'), 'prompt has the catalogue');
  assert(g.state.prompts[0].includes('The Weeknd'), 'prompt has the disruption title');
});

Deno.test('unchanged levers are not reported as changed', async () => {
  const { deps } = mk(fakeGemini(afternoon));
  const j = await (await handle(authedRequest(body({ levers: [{ kind: 'classesOnline', fromMin: 810, toMin: 1020, blocks: 'all' }] })), deps)).json();
  assertEquals(j.changedKinds, ['extraBuses']);
});

Deno.test('a question that changes no levers is not matched', async () => {
  const { deps } = mk(fakeGemini({ levers: [], restatement: 'Please ask about a lever.' }));
  const j = await (await handle(authedRequest(body({ question: 'zzz qqq' })), deps)).json();
  assertEquals(j.matched, false);
  assertEquals(j.levers, []);
  assertEquals(j.changedKinds, []);
});

Deno.test('the system prompt asks for every field of a lever kind', () => {
  for (const k of ['ask', 'plans'] as const) assert(SYSTEM_PROMPTS[k].includes('every field listed for its kind'), k);
});

Deno.test('an invalid lever is dropped and the call still succeeds', async () => {
  const { deps } = mk(fakeGemini(badLever));
  const res = await handle(authedRequest(body()), deps);
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.dropped, 1);
  assertEquals(j.levers.length, 1);
});

Deno.test('a repeated ask is served from ai_cache', async () => {
  const g = fakeGemini(afternoon);
  const { repo, deps } = mk(g);
  const a = await (await handle(authedRequest(body()), deps)).json();
  const b = await (await handle(authedRequest(body()), deps)).json();
  assertEquals(g.state.calls, 1);
  assertEquals(b, a);
  assertEquals(repo.tables.ai_cache.length, 1);
  await handle(authedRequest(body({ question: 'something else' })), deps);
  assertEquals(g.state.calls, 2);
});

Deno.test('validation, auth and Gemini failure', async () => {
  const { deps } = mk(fakeGemini(new GeminiError('schema', 'bad')));
  assertEquals((await handle(authedRequest(body(), null), deps)).status, 401);
  assertEquals((await handle(authedRequest(body({ question: 'x'.repeat(501) })), deps)).status, 400);
  assertEquals((await handle(authedRequest(body({ question: '' })), deps)).status, 400);
  assertEquals((await handle(authedRequest(body({ levers: 'no' })), deps)).status, 400);
  assertEquals((await handle(authedRequest({ question: 'q' }), deps)).status, 400);
  const res = await handle(authedRequest(body()), deps);
  assertEquals(res.status, 503);
  assertEquals((await res.json()).stale, undefined);
});

Deno.test('engine drops count as dropped and warnings are returned', async () => {
  const r = structuredClone(afternoon) as typeof afternoon;
  r.levers.extraBuses.push({ buses: 2, fromMin: 840, toMin: 840 });
  const { deps } = mk(fakeGemini(r));
  const j = await (await handle(authedRequest(body()), deps)).json();
  assertEquals(j.dropped, 1);
  assert(j.warnings.some((w: { code: string }) => w.code === 'lever_dropped'));
});

Deno.test('current levers appear in the prompt in wire shape', async () => {
  const g = fakeGemini(afternoon);
  const { deps } = mk(g);
  const cur = [{ kind: 'classesOnline', fromMin: 780, toMin: 1020, blocks: 'all' }];
  await handle(authedRequest(body({ levers: cur })), deps);
  const line = g.state.prompts[0].split('\n').find((l) => l.startsWith('Current levers'))!;
  assert(line.includes('{"classesOnline":[{"fromMin":780,"toMin":1020,"blocks":["all"]}]}'), line);
});
