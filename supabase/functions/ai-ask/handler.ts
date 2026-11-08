import { assembleBundle, fetchBundleRows } from '../_shared/bundle.ts';
import type { ContextRequest } from '../_shared/api.ts';
import type { LeverSet, Warning } from '../_shared/engine.ts';
import type { AiDeps } from '../_shared/estimate.ts';
import { GeminiError } from '../_shared/gemini.ts';
import { canonicalJson, sha256Hex } from '../_shared/hash.ts';
import { fail, HttpError, json, readJson } from '../_shared/http.ts';
import { coerceLevers, leverCatalogueText, toWireSet } from '../_shared/levers.ts';
import { PROMPT_VERSION, SYSTEM_PROMPTS } from '../_shared/prompts.ts';
import { serveRequest } from '../_shared/request.ts';
import { SCHEMAS } from '../_shared/schemas.ts';

interface AskBody { question?: unknown; context?: Partial<ContextRequest>; levers?: unknown }
interface AskResponse { matched: boolean; levers: LeverSet; restatement: string; changedKinds: string[]; dropped: number; warnings: Warning[] }

/** Kinds whose lever JSON differs between the input set and the result set. */
function changedKinds(before: LeverSet, after: LeverSet): string[] {
  const kinds = [...new Set([...after, ...before].map((l) => l.kind))];
  const sig = (set: LeverSet, kind: string) => canonicalJson(set.filter((l) => l.kind === kind));
  return kinds.filter((k) => sig(before, k) !== sig(after, k));
}

export function handle(req: Request, deps: AiDeps): Promise<Response> {
  return serveRequest(req, deps.repo, async () => {
    const body = await readJson<AskBody>(req);
    const { question, context, levers } = body ?? {};
    if (typeof question !== 'string' || question.trim() === '' || question.length > 500) {
      throw new HttpError(400, 'question is required (1-500 characters)');
    }
    if (!context || typeof context.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(context.date)) {
      throw new HttpError(400, 'context.date (YYYY-MM-DD) is required');
    }
    if (!Array.isArray(levers)) throw new HttpError(400, 'levers must be an array');
    const current = levers as LeverSet;
    const { date, disruptionId } = context;

    const hash = await sha256Hex(canonicalJson({ fn: 'ask', promptVersion: PROMPT_VERSION, question, date, disruptionId, levers: current }));
    const hit = await deps.repo.getCache(hash);
    if (hit) return json(hit);

    const bundle = assembleBundle(await fetchBundleRows(deps.repo.rows, date), { reconstructed: !!context.reconstructed });
    const disruption = bundle.context.disruptions.find((d) => d.id === disruptionId);
    const prompt = [
      leverCatalogueText(bundle),
      `Current levers (JSON): ${JSON.stringify(toWireSet(current))}`,
      `Date: ${date}. Day type: ${bundle.context.dayType}. Disruption: ${disruption?.title ?? 'none'}.`,
      `Manager's question: ${question}`,
      'Return the complete lever set that answers the question, keeping current levers the question does not change.',
    ].join('\n');

    try {
      const { data } = await deps.gemini<{ levers: unknown; restatement: string }>({
        apiKey: deps.apiKey, system: SYSTEM_PROMPTS.ask, prompt, schema: SCHEMAS.ask,
      });
      const coerced = coerceLevers(data.levers, bundle);
      const changed = changedKinds(current, coerced.levers);
      const response: AskResponse = {
        // A question that changes no lever was not understood as a scenario; the client keeps its levers.
        matched: changed.length > 0,
        levers: coerced.levers,
        restatement: data.restatement,
        changedKinds: changed,
        dropped: coerced.dropped,
        warnings: coerced.warnings,
      };
      await deps.repo.setCache(hash, 'ask', response);
      return json(response);
    } catch (e) {
      if (e instanceof GeminiError) return fail(503, 'AI is unavailable right now');
      throw e;
    }
  });
}
