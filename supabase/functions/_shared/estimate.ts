import { assembleBundle, fetchBundleRows } from './bundle.ts';
import type { EstimateRow } from './bundle.ts';
import { clampEstimate, ESTIMATE_KEYS } from './engine.ts';
import type { Estimate, EstimateKey } from './engine.ts';
import { canonicalJson, sha256Hex } from './hash.ts';
import { GEMINI_MODEL } from './gemini.ts';
import type { callGemini } from './gemini.ts';
import { HttpError } from './http.ts';
import { PROMPT_VERSION, SYSTEM_PROMPTS } from './prompts.ts';
import type { Repo } from './repo.ts';
import { SCHEMAS } from './schemas.ts';

export interface AiDeps { repo: Repo; gemini: typeof callGemini; apiKey: string; now: () => Date }

type Num = number | number[];
interface Reply { estimates: { key: EstimateKey; likely: Num; low: Num; high: Num; unit: string; reasoning: string; confidence: EstimateRow['confidence'] }[] }

export function toEstimate(r: EstimateRow): Estimate {
  return {
    key: r.key, disruptionId: r.disruption_id, likely: r.likely, low: r.low, high: r.high, unit: r.unit, reasoning: r.reasoning,
    confidence: r.confidence, model: r.model, createdAt: r.created_at, clamped: r.clamped,
  };
}

function keysFor(kind: string): EstimateKey[] {
  const all = ESTIMATE_KEYS.map((k) => k.key);
  if (kind === 'concert' || kind === 'sports') return all.filter((k) => k !== 'intakeShuttleDemand');
  if (kind === 'intake') return ['intakeShuttleDemand'];
  return [];
}

/** Clamp likely/low/high and keep low <= likely <= high (element-wise for curves). Null if the shape is unusable. */
function clampTriple(key: EstimateKey, likely: Num, low: Num, high: Num): { likely: Num; low: Num; high: Num; clamped: boolean } | null {
  const spec = ESTIMATE_KEYS.find((k) => k.key === key)!;
  const isCurve = spec.shape === 'curve';
  if (Array.isArray(likely) !== isCurve) return null;
  // A low/high of the wrong shape falls back to the likely value.
  const sameShape = (v: Num) => Array.isArray(v) === isCurve && (!isCurve || (v as number[]).length === 20);
  try {
    const l = clampEstimate(key, likely);
    const lo = clampEstimate(key, sameShape(low) ? low : likely);
    const hi = clampEstimate(key, sameShape(high) ? high : likely);
    const clamped = l.clamped || lo.clamped || hi.clamped;
    if (!isCurve) {
      const v = l.value as number;
      return { likely: v, low: Math.min(lo.value as number, v), high: Math.max(hi.value as number, v), clamped };
    }
    const lv = l.value as number[];
    return {
      likely: lv,
      low: (lo.value as number[]).map((x, i) => Math.min(x, lv[i])),
      high: (hi.value as number[]).map((x, i) => Math.max(x, lv[i])),
      clamped,
    };
  } catch {
    return null;
  }
}

/** `opts.deadlineAt` (epoch ms) bounds the Gemini call; without it callGemini uses its own default budget. */
export async function estimateForDisruption(
  deps: AiDeps,
  date: string,
  disruptionId: string,
  opts: { deadlineAt?: number } = {},
): Promise<{ estimates: EstimateRow[]; cached: boolean; missing: EstimateKey[] }> {
  const { repo } = deps;
  const rows = await fetchBundleRows(repo.rows, date);
  const d = rows.disruptions.find((x) => x.id === disruptionId);
  if (!d) throw new HttpError(404, 'disruption not found for that date');
  const keys = keysFor(d.kind);
  if (keys.length === 0) return { estimates: [], cached: false, missing: [] };

  const bundle = assembleBundle(rows);
  const sessionsScheduled = (bundle.timetable?.groups ?? []).reduce((a, g) => a + g.count, 0);
  const packet = {
    promptVersion: PROMPT_VERSION,
    date,
    dayType: bundle.context.dayType,
    disruption: {
      title: d.title,
      venue: d.venue,
      startAt: d.override_start_at ?? d.start_at,
      endAt: d.override_end_at ?? d.end_at,
      expectedAttendance: d.override_attendance ?? d.expected_attendance,
    },
    sessionsScheduled,
    typicalRidership: bundle.ridership?.typicalDailyBoardings.value ?? null,
    keys,
    bounds: ESTIMATE_KEYS.filter((k) => keys.includes(k.key)).map((k) => ({ key: k.key, shape: k.shape, min: k.min, max: k.max, unit: k.unit })),
  };
  const hash = await sha256Hex(canonicalJson(packet));

  const stored = await repo.getEstimatesByHash(hash);
  if (stored.length > 0) {
    const have = new Set(stored.map((r) => r.key));
    return { estimates: stored, cached: true, missing: keys.filter((k) => !have.has(k)) };
  }

  const { data } = await deps.gemini<Reply>({
    apiKey: deps.apiKey,
    system: SYSTEM_PROMPTS.estimate,
    prompt: `Estimate these keys for the disruption described. Curves have exactly 20 hourly points from 07:00 to 02:00.\n${canonicalJson(packet)}`,
    schema: SCHEMAS.estimate,
    ...(opts.deadlineAt !== undefined ? { deadlineAt: opts.deadlineAt } : {}),
  });

  const createdAt = deps.now().toISOString();
  const out: EstimateRow[] = [];
  for (const key of keys) {
    const e = data.estimates.find((x) => x.key === key);
    const c = e ? clampTriple(key, e.likely, e.low, e.high) : null;
    if (!e || !c) continue;
    out.push({
      context_hash: hash, disruption_id: disruptionId, date, key, likely: c.likely, low: c.low, high: c.high,
      unit: e.unit, reasoning: e.reasoning, confidence: e.confidence, model: GEMINI_MODEL, clamped: c.clamped, created_at: createdAt,
    });
  }
  await repo.insertEstimates(out);
  const have = new Set(out.map((r) => r.key));
  return { estimates: out, cached: false, missing: keys.filter((k) => !have.has(k)) };
}
