import { assert, assertEquals } from 'jsr:@std/assert@1';
import refused from '../../../shared/fixtures/recorded/gemini/grounding-refused.json' with { type: 'json' };
import extractRss from '../../../shared/fixtures/recorded/gemini/extract-rss.json' with { type: 'json' };
import extractLn from '../../../shared/fixtures/recorded/gemini/extract-livenation.json' with { type: 'json' };
import extractApu from '../../../shared/fixtures/recorded/gemini/extract-apu.json' with { type: 'json' };
import weeknd from '../../../shared/fixtures/recorded/gemini/estimate-weeknd.json' with { type: 'json' };
import type { DisruptionRow, DisruptionSourceRow } from '../../../shared/bundle/rows.ts';
import { GeminiError } from '../_shared/gemini.ts';
import type { callGemini } from '../_shared/gemini.ts';
import { SYSTEM_PROMPTS } from '../_shared/prompts.ts';
import { DEMO_TOKEN, SERVICE_TOKEN, TOKEN, seededRepo } from '../_shared/testkit.ts';
import { APU_URLS, handle, LIVENATION_URL, NEWS_QUERIES, newsUrl } from './handler.ts';

type Repo = ReturnType<typeof seededRepo>;

// Frozen clock: 06:00 MYT on Sun 8 Nov 2026. 12–13 Dec are inside the 120-day window; 26 May 2027 (200 days) is not.
const now = () => new Date('2026-11-07T22:00:00Z');
const NOW_ISO = now().toISOString();
const fixture = (name: string) => Deno.readTextFileSync(new URL(`../../../shared/fixtures/recorded/${name}`, import.meta.url));
const RSS = fixture('news-rss-bts.xml');
const LN_HOME = fixture('livenation-home.html');
const LN_BTS = fixture('livenation-bts.html');
const APU_INTAKE = fixture('apu-intake-calendar.html');
const LN_BTS_URL = 'https://www.livenation.my/event/bts-kuala-lumpur-2026-edp123456';

const req = (token: string | null) =>
  new Request('http://localhost/event-scan', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });

/** Fake fetch serving the recorded pages; the Indie Night event page and the APU holiday page are 404. `fail` makes every fetch throw. */
function pagesFetch(calls: string[], fail = false) {
  return ((url: string | URL | Request) => {
    const u = String(url);
    calls.push(u);
    if (fail) return Promise.reject(new TypeError('network down'));
    let body: string | null = null;
    if (u.startsWith('https://news.google.com/rss/search?')) body = RSS;
    else if (u === LIVENATION_URL) body = LN_HOME;
    else if (u === LN_BTS_URL) body = LN_BTS;
    else if (u === APU_URLS[0]) body = APU_INTAKE;
    return Promise.resolve(body === null ? new Response('not found', { status: 404 }) : new Response(body, { status: 200 }));
  }) as typeof fetch;
}

interface GCall { grounded: boolean; system: string; prompt: string; deadlineAt?: number }
/**
 * Fake Gemini routed by call kind: the grounding call (tools set) gets `grounding` (an error is thrown);
 * extract calls get the recorded extraction of every source labelled in the prompt; estimate calls get `estimate`.
 */
function scanGemini(calls: GCall[], o: { grounding?: unknown; estimate?: unknown; extract?: unknown } = {}) {
  const grounding = o.grounding ?? new GeminiError('grounding_unavailable', refused.error.message, refused.error.code);
  const estimate = o.estimate ?? weeknd;
  return ((opts: { tools?: unknown[]; system: string; prompt: string; deadlineAt?: number }) => {
    calls.push({ grounded: !!opts.tools, system: opts.system, prompt: opts.prompt, deadlineAt: opts.deadlineAt });
    let r: unknown;
    if (opts.tools) r = grounding;
    else if (opts.system === SYSTEM_PROMPTS.estimate) r = estimate;
    else if (o.extract) r = o.extract;
    else {
      const events = [
        ...(opts.prompt.includes('SOURCE: https://news.google.com/rss/') ? extractRss.events : []),
        ...(opts.prompt.includes(`SOURCE: ${LN_BTS_URL}`) ? extractLn.events : []),
        ...(opts.prompt.includes(`SOURCE: ${APU_URLS[0]}`) ? extractApu.events : []),
      ];
      r = { events };
    }
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve({ data: structuredClone(r), attempts: 1, model: 'gemini-3.5-flash-lite' });
  }) as unknown as typeof callGemini;
}

const deps = (repo: Repo, fetchFn: typeof fetch, gemini: typeof callGemini, clock?: () => number) => ({ repo, fetchFn, gemini, apiKey: 'k', now, clock });
const disruptions = (repo: Repo) => repo.tables.disruptions as DisruptionRow[];
const sourcesOf = (repo: Repo, id: string) => (repo.tables.disruption_sources as DisruptionSourceRow[]).filter((s) => s.disruption_id === id);
const byKey = (repo: Repo, key: string) => disruptions(repo).filter((d) => d.dedupe_key === key);
const jobRuns = (repo: Repo) => repo.tables.job_runs as { job_name: string }[];

async function scan(repo = seededRepo(), token: string | null = SERVICE_TOKEN, gOpts = {}, clock?: () => number) {
  const fetches: string[] = [];
  const gcalls: GCall[] = [];
  const res = await handle(req(token), deps(repo, pagesFetch(fetches), scanGemini(gcalls, gOpts), clock));
  return { repo, res, body: await res.json(), fetches, gcalls };
}

Deno.test('grounding refused: falls back, fetches every source and asks Gemini to extract', async () => {
  const { res, body, fetches, gcalls } = await scan();
  assertEquals(res.status, 200);
  assertEquals(body.method, 'fallback');
  assertEquals(body.groundingError, undefined);
  assertEquals(gcalls[0].grounded, true);
  assertEquals(gcalls[0].system, SYSTEM_PROMPTS.extract);
  assert(gcalls[0].prompt.startsWith('Find upcoming events (next 120 days) at TM Stadium Nasional, Unifi Arena and Bukit Jalil National Sports Complex, and APU intakes and holidays. Reply with JSON matching: {'));
  for (const q of NEWS_QUERIES) assert(fetches.includes(newsUrl(q)));
  assertEquals(newsUrl('Bukit Jalil concert'), 'https://news.google.com/rss/search?q=Bukit%20Jalil%20concert&hl=en-MY&gl=MY&ceid=MY:en');
  for (const u of [LIVENATION_URL, LN_BTS_URL, 'https://www.livenation.my/event/indie-night-zepp-kl-edp123457', ...APU_URLS]) assert(fetches.includes(u), u);
  // Indie Night event page and the APU holiday page are 404.
  assertEquals(body.sourcesFailed, 2);
  const extract = gcalls.filter((c) => !c.grounded && c.system === SYSTEM_PROMPTS.extract);
  assertEquals(extract.length, 1);
  assert(extract[0].prompt.length <= 40_000 + 1_000);
  assert(!extract[0].prompt.includes('do-not-read'), 'scripts are stripped');
  // Accepted: BTS x2 (RSS) + BTS x2 (Live Nation) + 2 intakes; rejected: Stadium Merdeka, 200 days ahead, Zepp KL.
  assertEquals([body.itemsFound, body.rejected, body.itemsChanged], [6, 3, 4]);
  assertEquals(body.estimatesFailed, 0);
});

Deno.test('BTS 12 and 13 Dec are stored as 2 rows, each with RSS and Live Nation sources', async () => {
  const { repo, gcalls } = await scan();
  for (const date of ['2026-12-12', '2026-12-13']) {
    const rows = byKey(repo, `TM Stadium Nasional|${date}`);
    assertEquals(rows.length, 1, date);
    const r = rows[0];
    // The seeded row for that night matches by dedupe_key and keeps its id.
    assertEquals(r.id, `bts-${date}`);
    assertEquals([r.title, r.type, r.kind, r.venue, r.origin], ['BTS Kuala Lumpur 2026', 'stadium_event', 'concert', 'TM Stadium Nasional', 'scan']);
    assertEquals([r.start_at, r.end_at], [`${date}T19:30:00+08:00`, `${date}T22:30:00+08:00`]);
    assertEquals([r.expected_attendance, r.attendance_label], [55000, 'verified']);
    assert(r.risk_level !== null, 'risk refreshed');
    const src = sourcesOf(repo, r.id);
    assert(src.some((s) => s.url.startsWith('https://news.example.my/')), 'RSS source');
    assert(src.some((s) => s.url === LN_BTS_URL), 'Live Nation source');
    const rss = src.find((s) => s.url === 'https://news.example.my/articles/bts-world-tour-kl-stadium-nasional')!;
    assertEquals([rss.title, rss.published_at, rss.fetched_at], ['BTS World Tour KL', '2026-10-20T02:00:00.000Z', NOW_ISO]);
    assertEquals(src.find((s) => s.url === LN_BTS_URL)!.published_at, null);
  }
  // One estimate call per new stadium event.
  assertEquals(gcalls.filter((c) => c.system === SYSTEM_PROMPTS.estimate).length, 2);
});

Deno.test('Stadium Merdeka, Zepp KL and an event 200 days ahead are rejected, not stored', async () => {
  const { repo } = await scan();
  const all = disruptions(repo);
  assert(!all.some((d) => /harimau|merdeka/i.test(`${d.title} ${d.venue}`)));
  assert(!all.some((d) => /indie/i.test(d.title)));
  assert(!all.some((d) => d.start_at.startsWith('2027-05-26')));
});

Deno.test('APU intake items are stored as apu_calendar intakes for the whole day', async () => {
  const { repo } = await scan();
  const rows = disruptions(repo).filter((d) => d.dedupe_key === 'APU|2026-11-17' || d.dedupe_key === 'APU|2026-12-01');
  assertEquals(rows.map((r) => [r.id, r.type, r.kind, r.venue, r.start_at, r.end_at]).sort(), [
    ['intake-degree-level-1-2026-12-01', 'apu_calendar', 'intake', 'APU', '2026-12-01T00:00:00+08:00', '2026-12-01T23:59:00+08:00'],
    ['intake-foundation-2026-11-17', 'apu_calendar', 'intake', 'APU', '2026-11-17T00:00:00+08:00', '2026-11-17T23:59:00+08:00'],
  ]);
  assertEquals(sourcesOf(repo, 'intake-foundation-2026-11-17').map((s) => s.url), [APU_URLS[0]]);
});

Deno.test('pre-existing BTS rows keep override_attendance 60000 and dismissed status, and are not duplicated', async () => {
  const repo = seededRepo();
  const [d12, d13] = ['bts-2026-12-12', 'bts-2026-12-13'].map((id) => disruptions(repo).find((d) => d.id === id)!);
  Object.assign(d12, { override_attendance: 60000, overridden_by: 'u1', overridden_at: '2026-11-06T10:00:00+08:00' });
  Object.assign(d13, { status: 'dismissed', override_attendance: 60000 });
  const { body, gcalls } = await scan(repo);
  assertEquals(body.itemsChanged, 4);
  for (const [d, date] of [[d12, '2026-12-12'], [d13, '2026-12-13']] as const) {
    const rows = byKey(repo, `TM Stadium Nasional|${date}`);
    assertEquals(rows.map((r) => r.id), [d.id]);
    assertEquals(rows[0].override_attendance, 60000);
    assertEquals(rows[0].title, 'BTS Kuala Lumpur 2026');
    assertEquals(rows[0].attendance_label, 'verified');
    const src = sourcesOf(repo, d.id).map((s) => s.url);
    assert(src.includes(LN_BTS_URL) && src.includes('https://news.example.my/articles/bts-world-tour-kl-stadium-nasional'));
  }
  assertEquals(byKey(repo, 'TM Stadium Nasional|2026-12-12')[0].overridden_by, 'u1');
  assertEquals(byKey(repo, 'TM Stadium Nasional|2026-12-13')[0].status, 'dismissed');
  assertEquals(disruptions(repo).filter((d) => d.id.startsWith('bts-kuala-lumpur')).length, 0);
  // The dismissed row gets no estimate.
  assertEquals(gcalls.filter((c) => c.system === SYSTEM_PROMPTS.estimate).length, 1);
});

Deno.test('a second scan finds nothing new to change', async () => {
  const { repo } = await scan();
  const again = await scan(repo);
  assertEquals([again.body.itemsFound, again.body.itemsChanged], [6, 0]);
  assertEquals(byKey(repo, 'TM Stadium Nasional|2026-12-12').length, 1);
  assertEquals(again.gcalls.filter((c) => c.system === SYSTEM_PROMPTS.estimate).length, 0);
});

Deno.test('grounding success: method grounding, no page fetches', async () => {
  const { body, fetches, repo } = await scan(seededRepo(), SERVICE_TOKEN, { grounding: extractLn });
  assertEquals(body.method, 'grounding');
  assertEquals(fetches.length, 0);
  assertEquals([body.itemsFound, body.rejected, body.itemsChanged, body.sourcesFailed], [2, 1, 2, 0]);
  assertEquals(byKey(repo, 'TM Stadium Nasional|2026-12-13').length, 1);
});

Deno.test('a grounding error other than refusal falls back and notes the error', async () => {
  const { res, body } = await scan(seededRepo(), SERVICE_TOKEN, { grounding: new GeminiError('http', 'upstream 500', 500) });
  assertEquals(res.status, 200);
  assertEquals(body.method, 'fallback');
  assertEquals(body.groundingError, 'http');
});

Deno.test('estimate failures are counted, not fatal', async () => {
  const { res, body } = await scan(seededRepo(), SERVICE_TOKEN, { estimate: new GeminiError('rate_limited', 'slow down', 429) });
  assertEquals(res.status, 200);
  assertEquals(body.estimatesFailed, 2);
  assertEquals(body.itemsChanged, 4);
});

Deno.test('every source fetch failing fails the job and leaves disruptions untouched', async () => {
  const repo = seededRepo();
  const before = structuredClone(disruptions(repo));
  const fetches: string[] = [];
  const res = await handle(req(SERVICE_TOKEN), deps(repo, pagesFetch(fetches, true), scanGemini([])));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, 'event-scan: all sources failed');
  assertEquals(fetches.length, NEWS_QUERIES.length + 1 + APU_URLS.length);
  const job = await repo.latestJob('event-scan');
  assertEquals([job?.status, job?.errorSummary], ['failed', 'event-scan: all sources failed']);
  assertEquals(disruptions(repo), before);
});

Deno.test('every extraction batch failing fails the job', async () => {
  const repo = seededRepo();
  const res = await handle(req(SERVICE_TOKEN), deps(repo, pagesFetch([]), scanGemini([], { extract: new GeminiError('schema', 'bad') })));
  assertEquals(res.status, 500);
  assertEquals((await repo.latestJob('event-scan'))?.status, 'failed');
});

const seedJob = (repo: Repo, startedAt: string, status = 'success') =>
  jobRuns(repo).push({ id: 1, job_name: 'event-scan', started_at: startedAt, finished_at: startedAt, status, method: 'fallback', items_found: 6, items_changed: 4, error_summary: null } as never);

Deno.test('a demo caller within 10 minutes of a successful scan gets reused: true and no new job run', async () => {
  const repo = seededRepo();
  seedJob(repo, '2026-11-07T21:52:00.000Z');
  const { res, body, fetches, gcalls } = await scan(repo, DEMO_TOKEN);
  assertEquals(res.status, 200);
  assertEquals(body, { reused: true, jobRunId: 1, itemsFound: 6, itemsChanged: 4, method: 'fallback' });
  assertEquals(jobRuns(repo).length, 1);
  assertEquals([fetches.length, gcalls.length], [0, 0]);
});

Deno.test('a manager after 10 minutes, after a failed scan, or the service role always scans', async () => {
  for (const [token, startedAt, status] of [
    [TOKEN, '2026-11-07T21:49:00.000Z', 'success'],
    [TOKEN, '2026-11-07T21:58:00.000Z', 'failed'],
    [SERVICE_TOKEN, '2026-11-07T21:58:00.000Z', 'success'],
  ] as const) {
    const repo = seededRepo();
    seedJob(repo, startedAt, status);
    const { res, body } = await scan(repo, token);
    assertEquals(res.status, 200);
    assertEquals(body.reused, undefined);
    assertEquals(jobRuns(repo).length, 2);
  }
});

Deno.test('no caller or an unknown token is 401; responses carry CORS headers; OPTIONS is a preflight', async () => {
  for (const token of [null, 'nope']) {
    const { res, fetches } = await scan(seededRepo(), token);
    assertEquals(res.status, 401);
    assertEquals(fetches.length, 0);
  }
  const ok = await scan(seededRepo(), DEMO_TOKEN);
  assert(ok.res.headers.get('Access-Control-Allow-Origin'));
  const pre = await handle(new Request('http://localhost/event-scan', { method: 'OPTIONS' }), deps(seededRepo(), pagesFetch([]), scanGemini([])));
  assertEquals(pre.status, 200);
});

// Review fix 2: the bare key belongs to the stored event, not to whichever event Gemini lists first.
const apuEvent = (title: string) => ({
  title, venue: 'APU campus', startDate: '2026-11-12', expectedAttendance: null, attendanceStated: false, isApuCalendar: true,
  calendarKind: 'other', sourceUrls: ['https://www.apu.edu.my/intake-calendar'], confidence: 'high',
});
const storedA = (repo: Repo) => {
  const a = disruptions(repo).find((d) => d.id === 'intake-2026-11-12')!;
  assertEquals([a.dedupe_key, a.title], ['APU|2026-11-12', 'Intake: Degree Level 2']);
  Object.assign(a, { override_attendance: 900, overridden_by: 'u1', status: 'dismissed' });
  return structuredClone(a);
};

Deno.test('stored event A keeps its row when the scan lists another event B first', async () => {
  const repo = seededRepo();
  const before = storedA(repo);
  const a = apuEvent('Intake: Degree Level 2');
  const { body } = await scan(repo, SERVICE_TOKEN, { grounding: { events: [apuEvent('Graduation rehearsal'), { ...a, calendarKind: 'intake' }] } });
  assertEquals(body.method, 'grounding');
  const rowA = disruptions(repo).find((d) => d.id === 'intake-2026-11-12')!;
  assertEquals([rowA.title, rowA.kind, rowA.dedupe_key], [before.title, 'intake', 'APU|2026-11-12']);
  assertEquals([rowA.override_attendance, rowA.overridden_by, rowA.status], [900, 'u1', 'dismissed']);
  const rowB = byKey(repo, 'APU|2026-11-12|graduation-rehearsal');
  assertEquals(rowB.map((r) => [r.id, r.title, r.status, r.override_attendance]), [['graduation-rehearsal-2026-11-12', 'Graduation rehearsal', 'active', null]]);
});

Deno.test('only event B (a single cluster) updates the scan fields of stored A; its override and dismissed status stay', async () => {
  const repo = seededRepo();
  storedA(repo);
  const { body } = await scan(repo, SERVICE_TOKEN, { grounding: { events: [apuEvent('Graduation rehearsal')] } });
  assertEquals(body.itemsChanged, 1);
  const rowA = disruptions(repo).find((d) => d.id === 'intake-2026-11-12')!;
  assertEquals([rowA.title, rowA.dedupe_key, rowA.start_at], ['Graduation rehearsal', 'APU|2026-11-12', '2026-11-12T00:00:00+08:00']);
  assertEquals([rowA.override_attendance, rowA.overridden_by, rowA.status], [900, 'u1', 'dismissed']);
  assertEquals(disruptions(repo).filter((d) => d.dedupe_key?.startsWith('APU|2026-11-12')).length, 1);
});

Deno.test('two dissimilar clusters, B listed first: stored A is untouched and both get slug keys', async () => {
  const repo = seededRepo();
  const before = storedA(repo);
  const { body } = await scan(repo, SERVICE_TOKEN, { grounding: { events: [apuEvent('Graduation rehearsal'), apuEvent('Library closure')] } });
  assertEquals(body.itemsChanged, 2);
  assertEquals(disruptions(repo).find((d) => d.id === 'intake-2026-11-12'), before);
  assertEquals(byKey(repo, 'APU|2026-11-12|graduation-rehearsal').length, 1);
  assertEquals(byKey(repo, 'APU|2026-11-12|library-closure').length, 1);
});

Deno.test('a single scanned cluster with a dissimilar title updates the seeded row, keeping override and dismissed', async () => {
  const repo = seededRepo();
  const d12 = disruptions(repo).find((d) => d.id === 'bts-2026-12-12')!;
  Object.assign(d12, { override_attendance: 60000, overridden_by: 'u1', status: 'dismissed' });
  const ev = { ...extractLn.events[0], title: 'BTS Arirang Tour', endDate: undefined };
  const { body } = await scan(repo, SERVICE_TOKEN, { grounding: { events: [ev] } });
  assertEquals(body.itemsChanged, 1);
  const rows = byKey(repo, 'TM Stadium Nasional|2026-12-12');
  assertEquals(rows.map((r) => [r.id, r.title, r.override_attendance, r.overridden_by, r.status]), [['bts-2026-12-12', 'BTS Arirang Tour', 60000, 'u1', 'dismissed']]);
  assertEquals(disruptions(repo).filter((d) => d.dedupe_key?.startsWith('TM Stadium Nasional|2026-12-12')).length, 1);
});

// Review fix 3: time budget.
Deno.test('the grounding call is capped at 40 s; extract calls share the 95 s run deadline', async () => {
  const T0 = 1_000_000;
  const { body, gcalls } = await scan(seededRepo(), SERVICE_TOKEN, {}, () => T0);
  assertEquals(body.method, 'fallback');
  assertEquals(gcalls[0].grounded, true);
  assertEquals(gcalls[0].deadlineAt, T0 + 40_000);
  const extract = gcalls.filter((c) => !c.grounded && c.system === SYSTEM_PROMPTS.extract);
  assert(extract.length > 0);
  for (const c of extract) assertEquals(c.deadlineAt, T0 + 95_000);
});

Deno.test('fetches are skipped (and count as failed) once less than 20 s remain', async () => {
  const T0 = 1_000_000;
  let t = T0;
  const clock = () => t;
  const repo = seededRepo();
  const fetches: string[] = [];
  const gcalls: GCall[] = [];
  // Grounding "takes" 76 s, leaving 19 s of the 95 s budget.
  const gemini = ((o: { tools?: unknown[] }) => {
    if (o.tools) t = T0 + 76_000;
    return scanGemini(gcalls)(o as never);
  }) as unknown as typeof callGemini;
  const res = await handle(req(SERVICE_TOKEN), deps(repo, pagesFetch(fetches), gemini, clock));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, 'event-scan: all sources failed');
  assertEquals(fetches.length, 0);
});

Deno.test('extract batches run at most 3 at a time and keep batch order', async () => {
  const big = (n: number) => `<html><body>${`Event listing ${n} `.repeat(1500)}</body></html>`;
  const pages = Array.from({ length: 8 }, (_, i) => `<a href="/event/e${i}">e</a>`).join('');
  const fetchFn = ((url: string | URL | Request) => {
    const u = String(url);
    const m = /\/event\/e(\d)$/.exec(u);
    const body = u === LIVENATION_URL ? pages : m ? big(Number(m[1])) : null;
    return Promise.resolve(body === null ? new Response('x', { status: 404 }) : new Response(body));
  }) as typeof fetch;
  let active = 0, peak = 0;
  const order: number[] = [];
  const gemini = (async (o: { tools?: unknown[]; prompt: string }) => {
    if (o.tools) throw new GeminiError('grounding_unavailable', 'no');
    active++;
    peak = Math.max(peak, active);
    const first = Number(/SOURCE: https:\/\/www\.livenation\.my\/event\/e(\d)/.exec(o.prompt)?.[1] ?? -1);
    await new Promise((r) => setTimeout(r, first === 0 ? 20 : 1));
    active--;
    order.push(first);
    const ev = { ...extractLn.events[0], title: `Show ${first}`, startDate: '2026-12-20', endDate: undefined, sourceUrls: [`https://x.example/${first}`] };
    return { data: { events: [ev] }, attempts: 1, model: 'm' };
  }) as unknown as typeof callGemini;
  const repo = seededRepo();
  const res = await handle(req(SERVICE_TOKEN), deps(repo, fetchFn, gemini));
  assertEquals(res.status, 200);
  assert(order.length >= 4, `batches: ${order.length}`);
  assertEquals(peak, 3);
  // Batch 0 finished last-ish but its event still came first, so it took the bare key.
  assertEquals(byKey(repo, 'TM Stadium Nasional|2026-12-20')[0]?.title, `Show ${Math.min(...order.filter((n) => n >= 0))}`);
});

// Final review: one 95 s budget, risks before estimates, notes in job_runs, concurrent scans.
Deno.test('estimates get the shared 95 s deadline, and risks are refreshed before the first estimate call', async () => {
  const T0 = 1_000_000;
  let t = T0;
  const repo = seededRepo();
  for (const d of disruptions(repo)) d.risk_level = null;
  const estimateDeadlines: (number | undefined)[] = [];
  const riskAtFirstEstimate: (string | null)[] = [];
  const inner = scanGemini([]);
  const gemini = ((o: { tools?: unknown[]; system: string; deadlineAt?: number }) => {
    // The extract call "takes" until 79 s: 16 s remain, enough to start the estimates.
    if (!o.tools && o.system === SYSTEM_PROMPTS.extract) t = T0 + 79_000;
    if (o.system === SYSTEM_PROMPTS.estimate) {
      if (estimateDeadlines.length === 0) riskAtFirstEstimate.push(...['bts-2026-12-12', 'bts-2026-12-13'].map((id) => disruptions(repo).find((d) => d.id === id)!.risk_level));
      estimateDeadlines.push(o.deadlineAt);
    }
    return inner(o as never);
  }) as unknown as typeof callGemini;
  const res = await handle(req(SERVICE_TOKEN), deps(repo, pagesFetch([]), gemini, () => t));
  assertEquals(res.status, 200);
  assertEquals(estimateDeadlines, [T0 + 95_000, T0 + 95_000]);
  assert(riskAtFirstEstimate.every((r) => r !== null), 'risk set before estimates');
});

Deno.test('estimates are skipped (and counted as failed) when less than 15 s remain; the rows still get a risk level', async () => {
  const T0 = 1_000_000;
  let t = T0;
  const repo = seededRepo();
  for (const d of disruptions(repo)) d.risk_level = null;
  const gcalls: GCall[] = [];
  const inner = scanGemini(gcalls);
  const gemini = ((o: { tools?: unknown[]; system: string }) => {
    // The extract call "takes" until 81 s: 14 s remain.
    if (!o.tools && o.system === SYSTEM_PROMPTS.extract) t = T0 + 81_000;
    return inner(o as never);
  }) as unknown as typeof callGemini;
  const res = await handle(req(SERVICE_TOKEN), deps(repo, pagesFetch([]), gemini, () => t));
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.estimatesFailed, 2);
  assertEquals(gcalls.filter((c) => c.system === SYSTEM_PROMPTS.estimate).length, 0);
  assert(byKey(repo, 'TM Stadium Nasional|2026-12-12')[0].risk_level !== null);
  assertEquals((await repo.latestJob('event-scan'))?.errorSummary, 'sources failed 2/10; estimates failed 2');
});

Deno.test('a fallback scan with a grounding error and failed sources records success with a note as error_summary', async () => {
  const { res, body, repo } = await scan(seededRepo(), SERVICE_TOKEN, { grounding: new GeminiError('rate_limited', 'slow down', 429) });
  assertEquals(res.status, 200);
  assertEquals(body.note, 'grounding: rate_limited; sources failed 2/10');
  const job = await repo.latestJob('event-scan');
  assertEquals([job?.status, job?.errorSummary], ['success', 'grounding: rate_limited; sources failed 2/10']);
});

Deno.test('a clean grounding scan records no error_summary', async () => {
  const { body, repo } = await scan(seededRepo(), SERVICE_TOKEN, { grounding: extractLn });
  assertEquals(body.note, undefined);
  assertEquals((await repo.latestJob('event-scan'))?.errorSummary, null);
});

Deno.test('a manager or demo caller joins a scan running for under 3 minutes; an older running row does not block', async () => {
  const repo = seededRepo();
  seedJob(repo, '2026-11-07T21:58:00.000Z', 'running');
  const { res, body, fetches, gcalls } = await scan(repo, DEMO_TOKEN);
  assertEquals(res.status, 200);
  assertEquals(body, { reused: true, running: true, jobRunId: 1 });
  assertEquals(jobRuns(repo).length, 1);
  assertEquals([fetches.length, gcalls.length], [0, 0]);

  const older = seededRepo();
  seedJob(older, '2026-11-07T21:56:00.000Z', 'running');
  const again = await scan(older, TOKEN);
  assertEquals(again.body.reused, undefined);
  assertEquals(jobRuns(older).length, 2);
});
