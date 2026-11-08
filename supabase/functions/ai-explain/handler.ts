import type { ContextRequest } from '../_shared/api.ts';
import type { LeverSet, Summary } from '../_shared/engine.ts';
import type { AiDeps } from '../_shared/estimate.ts';
import { factsSheet, numbersOutside } from '../_shared/facts.ts';
import { GeminiError, newDeadline } from '../_shared/gemini.ts';
import { canonicalJson, sha256Hex } from '../_shared/hash.ts';
import { fail, HttpError, json, readJson } from '../_shared/http.ts';
import { PROMPT_VERSION, SYSTEM_PROMPTS } from '../_shared/prompts.ts';
import { serveRequest } from '../_shared/request.ts';
import { SCHEMAS } from '../_shared/schemas.ts';

interface ExplainBody { context?: Partial<ContextRequest>; levers?: unknown; noAction?: unknown; withPlan?: unknown }

const isSummary = (s: unknown): s is Summary =>
  !!s && typeof s === 'object' && 'peakApuQueue' in s && 'peaks' in s && 'learningDisruption' in s && Array.isArray((s as Summary).costLines);

const sentenceCount = (t: string) => (t.match(/[.!?](\s|$)/g) ?? []).length;

export function handle(req: Request, deps: AiDeps): Promise<Response> {
  return serveRequest(req, deps.repo, async () => {
    const body = await readJson<ExplainBody>(req);
    const { context, levers, noAction, withPlan } = body ?? {};
    if (!context || typeof context.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(context.date)) {
      throw new HttpError(400, 'context.date (YYYY-MM-DD) is required');
    }
    if (!Array.isArray(levers)) throw new HttpError(400, 'levers must be an array');
    if (!isSummary(noAction) || !isSummary(withPlan)) throw new HttpError(400, 'noAction and withPlan summaries are required');

    const hash = await sha256Hex(canonicalJson({ fn: 'explain', promptVersion: PROMPT_VERSION, context, levers, noAction, withPlan }));
    const hit = await deps.repo.getCache(hash);
    if (hit) return json(hit);

    const { text: facts, allowedNumbers } = factsSheet(noAction, withPlan, levers as LeverSet);
    const basePrompt = `Facts:\n${facts}`;
    let prompt = basePrompt;
    const deadlineAt = newDeadline();
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data } = await deps.gemini<{ text: string }>({
          apiKey: deps.apiKey, deadlineAt, system: SYSTEM_PROMPTS.explain, prompt, schema: SCHEMAS.explain,
        });
        const outside = numbersOutside(data.text, allowedNumbers);
        const sentences = sentenceCount(data.text);
        if (outside.length === 0 && sentences >= 3 && sentences <= 6) {
          const response = { text: data.text };
          await deps.repo.setCache(hash, 'explain', response);
          return json(response);
        }
        const problems: string[] = [];
        if (outside.length > 0) problems.push(`it cited numbers not in the facts: ${outside.join(', ')}. Remove them`);
        if (sentences < 3 || sentences > 6) problems.push(`it had ${sentences} sentences; use 3 to 6`);
        prompt = `${basePrompt}\n\nYour previous answer was rejected: ${problems.join('; ')}. Write it again using only numbers from the facts.`;
      }
      return fail(502, 'explanation cited numbers not in the input');
    } catch (e) {
      if (e instanceof GeminiError) return fail(503, 'AI is unavailable right now');
      throw e;
    }
  });
}
