import { assembleBundle, fetchBundleRows } from '../_shared/bundle.ts';
import type { ContextRequest, PlanProposal } from '../_shared/api.ts';
import { evaluatePlan, durationText } from '../_shared/engine.ts';
import type { AiDeps } from '../_shared/estimate.ts';
import { GeminiError } from '../_shared/gemini.ts';
import { canonicalJson, sha256Hex } from '../_shared/hash.ts';
import { fail, HttpError, json, readJson } from '../_shared/http.ts';
import { coerceLevers, leverCatalogueText } from '../_shared/levers.ts';
import { PROMPT_VERSION, SYSTEM_PROMPTS } from '../_shared/prompts.ts';
import type { PlanRowInput } from '../_shared/repo.ts';
import { serveRequest } from '../_shared/request.ts';
import { SCHEMAS } from '../_shared/schemas.ts';

interface PlansBody { context?: Partial<ContextRequest>; budgetRm?: unknown }
interface Reply { plans: { name: string; levers: unknown; rationale: string }[] }

export function handle(req: Request, deps: AiDeps): Promise<Response> {
  return serveRequest(req, deps.repo, async (caller) => {
    const body = await readJson<PlansBody>(req);
    const { context, budgetRm } = body ?? {};
    if (!context || typeof context.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(context.date)) {
      throw new HttpError(400, 'context.date (YYYY-MM-DD) is required');
    }
    if (typeof budgetRm !== 'number' || !Number.isFinite(budgetRm) || budgetRm <= 0 || budgetRm > 100000) {
      throw new HttpError(400, 'budgetRm must be greater than 0 and at most 100000');
    }
    const { date, disruptionId } = context;

    const bundle = assembleBundle(await fetchBundleRows(deps.repo.rows, date), { reconstructed: !!context.reconstructed });
    const inputHash = await sha256Hex(canonicalJson(bundle));
    const hash = await sha256Hex(canonicalJson({ fn: 'plans', promptVersion: PROMPT_VERSION, date, disruptionId, budgetRm, inputHash }));
    const hit = await deps.repo.getCache(hash) as { plans: PlanProposal[]; dropped?: unknown } | null;
    if (hit) {
      // Cached ids must still exist for decision-create. If plan rows were deleted, re-insert them from the cache (no Gemini).
      const present = await Promise.all(hit.plans.map((p) => deps.repo.getPlan(p.id)));
      if (present.every(Boolean)) return json(hit);
      const missing = hit.plans.filter((_, i) => !present[i]);
      const ids = await deps.repo.insertPlans(missing.map((p) => ({
        context_date: date,
        disruption_id: disruptionId ?? null,
        name: p.name,
        levers: p.levers,
        rationale: p.rationale,
        cost_lines: p.costLines,
        total_cost_rm: p.totalCostRm,
        summary: p.summary,
        no_action_summary: p.noActionSummary,
        budget_rm: budgetRm,
        over_budget: p.overBudget,
        created_by: caller.userId,
      })));
      let next = 0;
      const healed = { ...hit, plans: hit.plans.map((p, i) => (present[i] ? p : { ...p, id: ids[next++].id })) };
      await deps.repo.setCache(hash, 'plans', healed);
      return json(healed);
    }

    const disruption = bundle.context.disruptions.find((d) => d.id === disruptionId);
    const baseline = evaluatePlan(bundle, [], budgetRm).noAction.summary;
    const s = bundle.settings;
    const prompt = [
      leverCatalogueText(bundle),
      `Budget: RM ${budgetRm}. Rates: half-day bus RM ${s.busHalfDayRm.value}, full-day bus RM ${s.busFullDayRm.value}, staff RM ${s.staffRatePerHourRm.value}/h.`,
      `Date: ${date}. Day type: ${bundle.context.dayType}. Disruption: ${disruption?.title ?? 'none'}${disruption ? ` at ${disruption.venue}` : ''}.`,
      `With no action: peak APU stop wait is ${baseline.peakApuWaitMin === null ? 'none' : durationText(baseline.peakApuWaitMin)}; ${baseline.totalRedMinutes} red minutes in total.`,
      'Propose three distinct plans that keep within the budget where possible.',
    ].join('\n');

    let data: Reply;
    try {
      ({ data } = await deps.gemini<Reply>({ apiKey: deps.apiKey, system: SYSTEM_PROMPTS.plans, prompt, schema: SCHEMAS.plans }));
    } catch (e) {
      if (e instanceof GeminiError) return fail(503, 'AI is unavailable right now');
      throw e;
    }

    // Every number comes from the engine; only name, levers and rationale come from Gemini.
    const evaluated = data.plans.map((p) => {
      const { levers, dropped } = coerceLevers(p.levers, bundle);
      return { p, levers, dropped, ev: evaluatePlan(bundle, levers, budgetRm) };
    });
    const rows: PlanRowInput[] = evaluated.map(({ p, levers, ev }) => ({
      context_date: date,
      disruption_id: disruptionId ?? null,
      name: p.name,
      levers,
      rationale: p.rationale,
      cost_lines: ev.withPlan.summary.costLines,
      total_cost_rm: ev.withPlan.summary.totalCostRm,
      summary: ev.withPlan.summary,
      no_action_summary: ev.noAction.summary,
      budget_rm: budgetRm,
      over_budget: ev.overBudget,
      created_by: caller.userId,
    }));
    const ids = await deps.repo.insertPlans(rows);
    const plans: PlanProposal[] = evaluated.map(({ p, levers, ev }, i) => ({
      id: ids[i].id,
      name: p.name,
      levers,
      rationale: p.rationale,
      costLines: ev.withPlan.summary.costLines,
      totalCostRm: ev.withPlan.summary.totalCostRm,
      summary: ev.withPlan.summary,
      noActionSummary: ev.noAction.summary,
      overBudget: ev.overBudget,
      budgetRm,
    }));
    const response = { plans, dropped: evaluated.map((e) => e.dropped) };
    await deps.repo.setCache(hash, 'plans', response);
    return json(response);
  });
}
