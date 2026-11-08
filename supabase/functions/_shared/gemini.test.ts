import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import valid from '../../../shared/fixtures/recorded/gemini/envelope-valid.json' with { type: 'json' };
import notJson from '../../../shared/fixtures/recorded/gemini/envelope-not-json.json' with { type: 'json' };
import err429 from '../../../shared/fixtures/recorded/gemini/envelope-error-429.json' with { type: 'json' };
import { callGemini, GeminiError } from './gemini.ts';
import type { JsonSchema } from './jsonschema.ts';

const schema: JsonSchema = {
  type: 'object',
  required: ['headline', 'levers'],
  properties: { headline: { type: 'string' }, levers: { type: 'array' } },
};

function fakeFetch(responses: Array<[number, unknown]>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const [status, body] = responses[Math.min(calls.length - 1, responses.length - 1)];
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as typeof fetch;
  return { fn, calls };
}

const base = { apiKey: 'k', system: 'sys', prompt: 'hello', schema };

Deno.test('valid envelope parses with attempts 1 and sends the right request', async () => {
  const f = fakeFetch([[200, valid]]);
  const r = await callGemini<{ headline: string }>({ ...base, fetchFn: f.fn });
  assertEquals(r.attempts, 1);
  assertEquals(r.model, 'gemini-3.5-flash-lite');
  assertEquals(r.data.headline, 'Shuttle crowding expected at 5pm');
  const { url, init } = f.calls[0];
  assertEquals(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assertEquals((init.headers as Record<string, string>)['x-goog-api-key'], 'k');
  const body = JSON.parse(init.body as string);
  assertEquals(body.generationConfig.temperature, 0.2);
  assertEquals(body.generationConfig.responseMimeType, 'application/json');
  assertEquals(body.generationConfig.responseJsonSchema, schema);
  assertEquals(body.systemInstruction.parts[0].text, 'sys');
  assertEquals(body.contents[0].role, 'user');
  assertEquals(body.contents[0].parts[0].text, 'hello');
  assert(!('tools' in body));
});

Deno.test('not-JSON then valid retries once with error feedback', async () => {
  const f = fakeFetch([[200, notJson], [200, valid]]);
  const r = await callGemini({ ...base, fetchFn: f.fn });
  assertEquals(r.attempts, 2);
  const second = JSON.parse(f.calls[1].init.body as string).contents[0].parts[0].text as string;
  assert(second.startsWith('hello'));
  assert(second.includes('Your previous reply did not match the schema:'));
  assert(second.includes('Reply again with JSON only.'));
});

Deno.test('schema-invalid twice throws schema error', async () => {
  const f = fakeFetch([[200, notJson]]);
  const e = await assertRejects(() => callGemini({ ...base, fetchFn: f.fn }), GeminiError);
  assertEquals(e.code, 'schema');
  assertEquals(f.calls.length, 2);
});

Deno.test('429 throws rate_limited without retry', async () => {
  const f = fakeFetch([[429, err429]]);
  const e = await assertRejects(() => callGemini({ ...base, fetchFn: f.fn }), GeminiError);
  assertEquals(e.code, 'rate_limited');
  assertEquals(e.status, 429);
  assertEquals(f.calls.length, 1);
});

Deno.test('other non-2xx throws http with status', async () => {
  const f = fakeFetch([[500, { error: { code: 500, message: 'boom' } }]]);
  const e = await assertRejects(() => callGemini({ ...base, fetchFn: f.fn }), GeminiError);
  assertEquals(e.code, 'http');
  assertEquals(e.status, 500);
});

Deno.test('tools: grounding 400 maps to grounding_unavailable; body omits schema config', async () => {
  const f = fakeFetch([[400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Search Grounding is not supported' } }]]);
  const tools = [{ google_search: {} }];
  const e = await assertRejects(() => callGemini({ ...base, tools, fetchFn: f.fn }), GeminiError);
  assertEquals(e.code, 'grounding_unavailable');
  const body = JSON.parse(f.calls[0].init.body as string);
  assertEquals(body.tools, tools);
  assert(!('responseMimeType' in body.generationConfig));
  assert(!('responseJsonSchema' in body.generationConfig));
});

Deno.test('tools: first {...} block is parsed from prose', async () => {
  const env = { candidates: [{ content: { parts: [{ text: 'Here you go:\n{"headline":"h","levers":[]}\nDone.' }] } }] };
  const f = fakeFetch([[200, env]]);
  const r = await callGemini<{ headline: string }>({ ...base, tools: [{ google_search: {} }], fetchFn: f.fn });
  assertEquals(r.data.headline, 'h');
  assertEquals(r.attempts, 1);
});

Deno.test('tools: a non-grounding 400 stays http', async () => {
  const f = fakeFetch([[400, { error: { message: 'bad request shape' } }]]);
  const e = await assertRejects(() => callGemini({ ...base, tools: [{}], fetchFn: f.fn }), GeminiError);
  assertEquals(e.code, 'http');
});

Deno.test('a fetch rejection becomes GeminiError http without status', async () => {
  const fn = (() => Promise.reject(new TypeError('network down'))) as typeof fetch;
  const e = await assertRejects(() => callGemini({ ...base, fetchFn: fn }), GeminiError);
  assertEquals(e.code, 'http');
  assertEquals(e.status, undefined);
});

// A fetch that never answers but honours the abort signal, like the real one.
function hangingFetch() {
  const calls: RequestInit[] = [];
  const fn = ((_url: string | URL | Request, init?: RequestInit) => {
    calls.push(init ?? {});
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    });
  }) as typeof fetch;
  return { fn, calls };
}

Deno.test('each attempt carries an abort signal', async () => {
  const f = fakeFetch([[200, valid]]);
  await callGemini({ ...base, fetchFn: f.fn });
  assert(f.calls[0].init.signal instanceof AbortSignal);
});

Deno.test('a hanging fetch is aborted at the deadline and becomes GeminiError http', async () => {
  const f = hangingFetch();
  const started = Date.now();
  const e = await assertRejects(() => callGemini({ ...base, fetchFn: f.fn, deadlineAt: Date.now() + 40 }), GeminiError);
  assertEquals(e.code, 'http');
  assertEquals(f.calls.length, 1);
  assert(Date.now() - started < 2000);
});

Deno.test('an expired deadline makes no request', async () => {
  const f = fakeFetch([[200, valid]]);
  const e = await assertRejects(() => callGemini({ ...base, fetchFn: f.fn, deadlineAt: Date.now() - 1 }), GeminiError);
  assertEquals(e.code, 'http');
  assertEquals(f.calls.length, 0);
});

Deno.test('a retry is skipped, throwing the schema error, when too little time remains', async () => {
  const f = fakeFetch([[200, notJson]]);
  let t = 1000;
  const fetchFn = ((u: string | URL | Request, i?: RequestInit) => { t += 9000; return f.fn(u, i); }) as typeof fetch;
  const e = await assertRejects(
    () => callGemini({ ...base, fetchFn, now: () => t, deadlineAt: 1000 + 10_000, minRetryMs: 5000 }),
    GeminiError,
  );
  assertEquals(e.code, 'schema');
  assertEquals(f.calls.length, 1);
});

Deno.test('with time left the retry still happens', async () => {
  const f = fakeFetch([[200, notJson], [200, valid]]);
  const r = await callGemini({ ...base, fetchFn: f.fn, now: () => 1000, deadlineAt: 1000 + 60_000 });
  assertEquals(r.attempts, 2);
});
