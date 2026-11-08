import { assembleBundle, fetchBundleRows } from '../_shared/bundle.ts';
import type { Announcement, ChecklistItem, ContextRequest, Decision, DecisionBundle } from '../_shared/api.ts';
import type { LeverSet, Summary } from '../_shared/engine.ts';
import { saveForecast } from '../_shared/forecastRow.ts';
import { fail, HttpError, json, readJson } from '../_shared/http.ts';
import { buildChecklist, dueAtIso } from '../_shared/plans.ts';
import type { AnnouncementRow, ChecklistRow, DecisionRow, Repo } from '../_shared/repo.ts';
import { errorCategory, serveRequest } from '../_shared/request.ts';
import type { PersistDeps } from '../forecast-save/handler.ts';

interface Body { planId?: unknown; context?: Partial<ContextRequest>; notes?: unknown; announcementText?: unknown }

const decisionOut = (d: DecisionRow): Decision => ({
  id: d.id, planId: d.plan_id ?? '', planName: d.plan_name, disruptionId: d.disruption_id, contextDate: d.context_date,
  decidedBy: d.decided_by ?? '', decidedAt: d.decided_at, status: d.status, notes: d.notes, totalCostRm: d.total_cost_rm,
  predicted: d.predicted as Summary, levers: d.levers as LeverSet, forecastId: d.forecast_id,
});
const checklistOut = (c: ChecklistRow): ChecklistItem => ({
  id: c.id, decisionId: c.decision_id, team: c.team, text: c.text, dueAt: c.due_at, done: c.done, doneBy: c.done_by, doneAt: c.done_at,
});
const announcementOut = (a: AnnouncementRow): Announcement => ({
  id: a.id, decisionId: a.decision_id, draft: a.draft, editedText: a.edited_text, updatedAt: a.updated_at,
});

export function handle(req: Request, deps: PersistDeps): Promise<Response> {
  return serveRequest(req, deps.repo, async (caller) => {
    const { planId, context, notes, announcementText } = (await readJson<Body>(req)) ?? {};
    if (typeof planId !== 'string' || !planId) throw new HttpError(400, 'planId is required');
    if (!context || typeof context.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(context.date)) {
      throw new HttpError(400, 'context.date (YYYY-MM-DD) is required');
    }
    if (typeof announcementText !== 'string') throw new HttpError(400, 'announcementText is required');
    if (notes !== null && notes !== undefined && typeof notes !== 'string') throw new HttpError(400, 'notes must be text or null');
    const date = context.date;

    // All validation happens before any write.
    const plan = await deps.repo.getPlan(planId);
    if (!plan) throw new HttpError(404, 'plan not found');
    if (plan.context_date !== date) throw new HttpError(400, 'plan belongs to a different date');

    // One disruption id for the forecast and the decision: the plan's own. A different one in the request is a client error.
    const disruptionId = plan.disruption_id ?? null;
    if (context.disruptionId !== undefined && context.disruptionId !== null && context.disruptionId !== disruptionId) {
      throw new HttpError(400, 'context.disruptionId does not match the plan');
    }

    const levers = plan.levers as LeverSet;
    const bundle = assembleBundle(await fetchBundleRows(deps.repo.rows, date), { reconstructed: !!context.reconstructed });
    const { id: forecastId, forecast } = await saveForecast(deps.repo, bundle, {
      date, disruptionId: disruptionId ?? undefined, levers, userId: caller.userId,
    });
    const decision = await deps.repo.insertDecision({
      plan_id: plan.id, forecast_id: forecastId, disruption_id: disruptionId,
      context_date: date, plan_name: plan.name, levers, predicted: forecast.summary,
      total_cost_rm: forecast.summary.totalCostRm, decided_by: caller.userId, notes: (notes as string | null | undefined) ?? null,
    });
    try {
      const checklist = await deps.repo.insertChecklist(buildChecklist(levers, bundle).map((d, i) => ({
        decision_id: decision.id, team: d.team, text: d.text, due_at: dueAtIso(date, d.dueMin), sort: i,
      })));
      const announcement = await deps.repo.insertAnnouncement({ decision_id: decision.id, draft: announcementText });
      const out: DecisionBundle = {
        decision: decisionOut(decision), checklist: checklist.map(checklistOut), announcement: announcementOut(announcement),
      };
      return json(out);
    } catch (e) {
      // The cascade removes any checklist rows already written.
      try { await deps.repo.deleteDecision(decision.id); } catch { console.error('decision rollback failed'); }
      console.error('decision-create failed after decision insert', errorCategory(e));
      return fail(500, 'could not save the decision');
    }
  });
}
