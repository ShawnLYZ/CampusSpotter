import { mytParts } from '../../../shared/bundle/assemble.ts';
import { addDays } from '../../../shared/engine/grid.ts';
import { getCaller } from '../_shared/auth.ts';
import { corsHeaders, preflight } from '../_shared/cors.ts';
import { estimateForDisruption } from '../_shared/estimate.ts';
import { GeminiError } from '../_shared/gemini.ts';
import type { callGemini } from '../_shared/gemini.ts';
import { fail, json } from '../_shared/http.ts';
import { requireServiceRole, runJob } from '../_shared/jobs.ts';
import { htmlToText, liveNationEventLinks, parseNewsRss } from '../_shared/parsers.ts';
import { SYSTEM_PROMPTS } from '../_shared/prompts.ts';
import type { Repo } from '../_shared/repo.ts';
import { refreshRisks } from '../_shared/risk.ts';
import { SCHEMAS } from '../_shared/schemas.ts';
import { clusterToRow, expandEvents, mergeCandidates, WINDOW_DAYS } from './candidates.ts';
import type { ExtractedEvent } from './candidates.ts';

export interface EventScanDeps {
  repo: Repo; fetchFn: typeof fetch; gemini: typeof callGemini; apiKey: string; now: () => Date;
  /** Wall clock (epoch ms) for time budgets, the same clock callGemini uses for deadlines. Default Date.now. */
  clock?: () => number;
}

export const JOB_NAME = 'event-scan';
export const NEWS_QUERIES = ['Stadium Nasional Bukit Jalil', 'TM Stadium Nasional concert', 'Unifi Arena event', 'Bukit Jalil concert', 'Bukit Jalil traffic event'];
export const newsUrl = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-MY&gl=MY&ceid=MY:en`;
export const LIVENATION_URL = 'https://www.livenation.my/';
export const APU_URLS = ['https://www.apu.edu.my/intake-calendar', 'https://www.apu.edu.my/apu-holiday-schedule'];
export const GROUNDING_PROMPT =
  'Find upcoming events (next 120 days) at TM Stadium Nasional, Unifi Arena and Bukit Jalil National Sports Complex, and APU intakes and holidays. ' +
  `Reply with JSON matching: ${JSON.stringify(SCHEMAS.extract)}`;

const REUSE_MS = 10 * 60 * 1000;
/** A manager or demo caller joins a scan that started less than this ago and is still running. */
const RUNNING_REUSE_MS = 3 * 60 * 1000;
/** The whole run's wall-clock budget: under pg_net's 120 s timeout and the Edge 150 s wall limit. */
export const SCAN_BUDGET_MS = 95_000;
const BATCH_CHARS = 40_000;
const SECTION_CHARS = 20_000;
const FETCH_TIMEOUT_MS = 15_000;
/** The grounding call may use at most this much of the run's budget. */
const GROUNDING_BUDGET_MS = 40_000;
/** No new fetch starts when less than this remains before the run deadline. */
const MIN_FETCH_BUDGET_MS = 20_000;
/** No estimate starts when less than this remains before the run deadline (it counts as failed). */
const MIN_ESTIMATE_BUDGET_MS = 15_000;
const EXTRACT_CONCURRENCY = 3;

type Extract = { events: ExtractedEvent[] };

/**
 * Scans for upcoming events near Bukit Jalil and APU calendar items. Service role always scans; a manager or demo caller
 * reuses a successful scan from the last 10 minutes, or joins a scan still running that started under 3 minutes ago.
 */
export async function handle(req: Request, deps: EventScanDeps): Promise<Response> {
  const pre = preflight(req);
  if (pre) return pre;
  let res: Response;
  try {
    if (!requireServiceRole(req)) {
      const caller = await getCaller(req, deps.repo);
      if (!caller) return fail(401, 'unauthorized');
      const last = await deps.repo.latestJob(JOB_NAME);
      if (last && last.status === 'running' && deps.now().getTime() - Date.parse(last.startedAt) < RUNNING_REUSE_MS) {
        return json({ reused: true, running: true, jobRunId: last.id });
      }
      if (last && last.status === 'success' && deps.now().getTime() - Date.parse(last.startedAt) < REUSE_MS) {
        return json({ reused: true, jobRunId: last.id, itemsFound: last.itemsFound, itemsChanged: last.itemsChanged, method: last.method });
      }
    }
    res = await runJob(deps.repo, JOB_NAME, () => scan(deps));
  } catch {
    return fail(500, 'internal error');
  }
  for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
  return res;
}

async function scan(deps: EventScanDeps) {
  const { repo, gemini, apiKey } = deps;
  const nowIso = deps.now().toISOString();
  const today = mytParts(nowIso).date;
  const clock = deps.clock ?? Date.now;
  // One 95 s wall-clock budget for the whole run; grounding gets at most 40 s of it.
  const start = clock();
  const deadlineAt = start + SCAN_BUDGET_MS;

  let events: ExtractedEvent[];
  let method: 'grounding' | 'fallback';
  let groundingError: string | undefined;
  let sourcesFailed = 0;
  let sourcesTotal = 0;
  let batchesFailed = 0;
  let publishedAt = new Map<string, string | null>();
  try {
    const { data } = await gemini<Extract>({
      apiKey, system: SYSTEM_PROMPTS.extract, prompt: GROUNDING_PROMPT, schema: SCHEMAS.extract, tools: [{ google_search: {} }],
      deadlineAt: start + GROUNDING_BUDGET_MS,
    });
    events = data.events;
    method = 'grounding';
  } catch (e) {
    const code = e instanceof GeminiError ? e.code : 'error';
    if (code !== 'grounding_unavailable') groundingError = code;
    const fb = await fallback(deps, today, deadlineAt, clock);
    ({ events, sourcesFailed, sourcesTotal, batchesFailed, publishedAt } = fb);
    method = 'fallback';
  }

  const { candidates, rejected } = expandEvents(Array.isArray(events) ? events : [], today);

  const existing = await repo.listDisruptions({
    fromIso: `${addDays(today, -1)}T00:00:00+08:00`, toIso: `${addDays(today, WINDOW_DAYS + 2)}T00:00:00+08:00`, includeDismissed: true,
  });
  const byKey = new Map(existing.filter((d) => d.dedupe_key).map((d) => [d.dedupe_key as string, d]));
  // Stored scan rows' titles by key, so a stored event keeps its bare key whatever order Gemini lists events in.
  const storedTitles = new Map(existing.filter((d) => d.origin === 'scan' && d.dedupe_key).map((d) => [d.dedupe_key as string, d.title]));
  const clusters = mergeCandidates(candidates, storedTitles);
  const takenIds = new Set(existing.map((d) => d.id));

  const changed: string[] = [];
  const toEstimate: { id: string; date: string }[] = [];
  for (const cluster of clusters) {
    const { row, sources } = clusterToRow(cluster, { nowIso, publishedAt });
    const match = byKey.get(cluster.key);
    if (!match && takenIds.has(row.id)) {
      // Another item (e.g. a manual one) already uses this id: pick a free suffix.
      let n = 2;
      while (takenIds.has(`${row.id}-${n}`)) n++;
      row.id = `${row.id}-${n}`;
      for (const s of sources) s.disruption_id = row.id;
    }
    const outcome = await repo.upsertScannedDisruption(row, sources);
    const id = match?.id ?? row.id;
    takenIds.add(id);
    if (outcome === 'unchanged') continue;
    changed.push(id);
    if (row.type === 'stadium_event' && match?.status !== 'dismissed') toEstimate.push({ id, date: cluster.date });
  }

  // Risks first, so a run killed during the estimates still leaves every new or changed row with a risk level.
  if (changed.length > 0) await refreshRisks(repo, { today, ids: changed });

  let estimatesFailed = 0;
  const estimated: string[] = [];
  for (const { id, date } of toEstimate) {
    if (deadlineAt - clock() < MIN_ESTIMATE_BUDGET_MS) {
      estimatesFailed++;
      continue;
    }
    try {
      await estimateForDisruption({ repo, gemini, apiKey, now: deps.now }, date, id, { deadlineAt });
      estimated.push(id);
    } catch {
      estimatesFailed++;
    }
  }

  // Estimates feed the risk, so the rows that got them are refreshed again.
  if (estimated.length > 0) await refreshRisks(repo, { today, ids: estimated });

  const note = [
    groundingError ? `grounding: ${groundingError}` : '',
    sourcesFailed > 0 ? `sources failed ${sourcesFailed}/${sourcesTotal}` : '',
    batchesFailed > 0 ? `batches failed ${batchesFailed}` : '',
    estimatesFailed > 0 ? `estimates failed ${estimatesFailed}` : '',
  ].filter(Boolean).join('; ');

  return {
    itemsFound: candidates.length,
    itemsChanged: changed.length,
    method,
    rejected,
    sourcesFailed,
    estimatesFailed,
    ...(method === 'fallback' ? { batchesFailed } : {}),
    ...(groundingError ? { groundingError } : {}),
    ...(note ? { note } : {}),
  };
}

/** Runs `fn` over `items` with at most `limit` in flight, returning results in input order. */
async function mapPool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Fetches news RSS, Live Nation and APU pages, reduces them to labelled text batches and extracts events from each batch. */
async function fallback(deps: EventScanDeps, today: string, deadlineAt: number, clock: () => number) {
  const { fetchFn, gemini, apiKey } = deps;
  let ok = 0;
  let sourcesFailed = 0;
  /**
   * Fetches one source and parses it with `parse`. A skipped fetch (under 20 s left), a non-OK status, a network
   * error or a parse error all count as that source failing. Returns the parse result, or null.
   */
  const load = async <R>(url: string, parse: (text: string) => R): Promise<R | null> => {
    if (deadlineAt - clock() < MIN_FETCH_BUDGET_MS) {
      sourcesFailed++;
      return null;
    }
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error('not ok');
      }
      const out = parse(await res.text());
      ok++;
      return out;
    } catch {
      sourcesFailed++;
      return null;
    }
  };

  const sections: string[] = [];
  const section = (url: string, text: string) => {
    if (text.trim()) sections.push(`SOURCE: ${url}\n${text.slice(0, SECTION_CHARS)}`);
  };

  const publishedAt = new Map<string, string | null>();
  const feeds = await Promise.all(NEWS_QUERIES.map(async (q) => ({ url: newsUrl(q), items: await load(newsUrl(q), parseNewsRss) })));
  for (const { url, items } of feeds) {
    if (items === null) continue;
    const lines: string[] = [];
    for (const item of items) {
      if (publishedAt.has(item.link)) continue;
      publishedAt.set(item.link, item.publishedAt);
      lines.push(`${item.title}\n${item.link}`);
    }
    section(url, lines.join('\n'));
  }

  const home = await load(LIVENATION_URL, (html) => ({ text: htmlToText(html), links: liveNationEventLinks(html, LIVENATION_URL) }));
  if (home !== null) {
    section(LIVENATION_URL, home.text);
    const pages = await Promise.all(home.links.map(async (url) => ({ url, text: await load(url, (h) => htmlToText(h)) })));
    for (const { url, text } of pages) if (text !== null) section(url, text);
  }

  const apu = await Promise.all(APU_URLS.map(async (url) => ({ url, text: await load(url, (h) => htmlToText(h)) })));
  for (const { url, text } of apu) if (text !== null) section(url, text);

  if (ok === 0) throw new Error('event-scan: all sources failed');

  const batches: string[] = [];
  for (const s of sections) {
    const last = batches.length - 1;
    if (last >= 0 && batches[last].length + 2 + s.length <= BATCH_CHARS) batches[last] += `\n\n${s}`;
    else batches.push(s);
  }

  // Batches run 3 at a time under the shared deadline; results are concatenated in batch order.
  const results = await mapPool(batches, EXTRACT_CONCURRENCY, async (batch): Promise<ExtractedEvent[] | null> => {
    try {
      const { data } = await gemini<Extract>({
        apiKey,
        system: SYSTEM_PROMPTS.extract,
        prompt:
          `Today is ${today} (Malaysia time). Extract the events in the sources below. Each source starts with a "SOURCE: <url>" line; ` +
          `put the URLs an event came from in sourceUrls, using the article link for news items.\n\n${batch}`,
        schema: SCHEMAS.extract,
        deadlineAt,
      });
      return Array.isArray(data?.events) ? data.events : [];
    } catch {
      return null;
    }
  });
  const batchesFailed = results.filter((r) => r === null).length;
  if (batches.length > 0 && batchesFailed === batches.length) throw new Error('event-scan: extraction failed for every batch');
  const events = results.flatMap((r) => r ?? []);

  return { events, sourcesFailed, sourcesTotal: ok + sourcesFailed, batchesFailed, publishedAt };
}
