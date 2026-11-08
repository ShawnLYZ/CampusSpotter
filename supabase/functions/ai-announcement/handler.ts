import type { ContextRequest, PlanProposal } from '../_shared/api.ts';
import type { AiDeps } from '../_shared/estimate.ts';
import { GeminiError, newDeadline } from '../_shared/gemini.ts';
import { fail, HttpError, json, readJson } from '../_shared/http.ts';
import type { ChecklistDraft } from '../_shared/plans.ts';
import { SYSTEM_PROMPTS } from '../_shared/prompts.ts';
import { serveRequest } from '../_shared/request.ts';
import { SCHEMAS } from '../_shared/schemas.ts';

interface AnnouncementBody { plan?: PlanProposal; context?: Partial<ContextRequest>; checklist?: ChecklistDraft[] }

const OPENING = 'Dear students,';
const CLOSING = '— APU Management';
const MAX_WORDS = 150;

const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

function problemsWith(draft: string): string[] {
  const text = draft.trim();
  const problems: string[] = [];
  const n = wordCount(text);
  if (n >= MAX_WORDS) problems.push(`it had ${n} words; use fewer than ${MAX_WORDS}`);
  if (!text.startsWith(OPENING)) problems.push(`it must start with "${OPENING}"`);
  if (!text.endsWith(CLOSING)) problems.push(`it must end with "${CLOSING}"`);
  return problems;
}

export function handle(req: Request, deps: AiDeps): Promise<Response> {
  return serveRequest(req, deps.repo, async () => {
    const body = await readJson<AnnouncementBody>(req);
    const { plan, context, checklist } = body ?? {};
    if (!plan || typeof plan !== 'object' || typeof plan.name !== 'string' || !Array.isArray(plan.costLines)) {
      throw new HttpError(400, 'plan is required');
    }
    if (!context || typeof context.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(context.date)) {
      throw new HttpError(400, 'context.date (YYYY-MM-DD) is required');
    }
    if (!Array.isArray(checklist)) throw new HttpError(400, 'checklist must be an array');

    const basePrompt = [
      `Date: ${context.date}.`,
      `Plan: ${plan.name}. ${plan.rationale ?? ''}`,
      'Plan actions:',
      ...plan.costLines.map((c) => `- ${c.text}`),
      'Checklist:',
      ...checklist.map((c) => `- [${c.team}] ${c.text}`),
      `Write the announcement under ${MAX_WORDS} words, starting with "${OPENING}" and ending with "${CLOSING}".`,
    ].join('\n');

    let prompt = basePrompt;
    const deadlineAt = newDeadline();
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data } = await deps.gemini<{ draft: string }>({
          apiKey: deps.apiKey, deadlineAt, system: SYSTEM_PROMPTS.announcement, prompt, schema: SCHEMAS.announcement,
        });
        const problems = problemsWith(data.draft);
        if (problems.length === 0) return json({ draft: data.draft.trim() });
        prompt = `${basePrompt}\n\nYour previous draft was rejected: ${problems.join('; ')}. Write it again.`;
      }
      return fail(502, 'announcement did not meet the length and format rules');
    } catch (e) {
      if (e instanceof GeminiError) return fail(503, 'AI is unavailable right now');
      throw e;
    }
  });
}
