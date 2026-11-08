import type { SupabaseClient } from '@supabase/supabase-js';
import type { Estimate, Forecast, LeverSet, Settings, Summary } from '@engine/index.ts';
import { BASELINE_TABLES, csvTemplate } from '@bundle/csv.ts';
import type { EstimateRow, SourceRow } from '@bundle/rows.ts';
import type { DataProvider } from '../DataProvider.ts';
import type { Announcement, ChecklistItem, CsvReport, Decision, DecisionBundle, EstimateView, PlanProposal, SourceInfo } from '../types.ts';
import { ProviderError, forbiddenWrite, toProviderError } from '../errors.ts';
import { markStale } from '../staleEstimates.ts';
import type { createInvoke } from './invoke.ts';
import { sourceStatus, type LatestRun } from './sourceStatus.ts';

type Invoke = ReturnType<typeof createInvoke>;
type Row = Record<string, unknown>;

const DECISION_SELECT = '*, profiles!decisions_decided_by_fkey(display_name)';
const ESTIMATED_KINDS = ['concert', 'sports', 'intake'];

export type DataMethods = Pick<DataProvider,
  'refreshEstimates' | 'ask' | 'explain' | 'generatePlans' | 'draftAnnouncement' | 'saveForecast' | 'createDecision' | 'listDecisions'
  | 'getDecision' | 'updateDecision' | 'setChecklistItemDone' | 'updateAnnouncement' | 'listSources' | 'listBaselineTables'
  | 'uploadBaselineCsv' | 'getCsvTemplate' | 'getSettings' | 'listEstimates'>;

function decisionFromRow(r: Row): Decision {
  const profile = r.profiles as { display_name?: string } | null;
  return {
    id: r.id as string, planId: (r.plan_id as string | null) ?? '', planName: r.plan_name as string, disruptionId: (r.disruption_id as string | null) ?? null,
    contextDate: r.context_date as string, decidedBy: profile?.display_name ?? '', decidedAt: r.decided_at as string,
    status: r.status as Decision['status'], notes: (r.notes as string | null) ?? null, totalCostRm: Number(r.total_cost_rm),
    predicted: r.predicted as Summary, levers: r.levers as LeverSet, forecastId: (r.forecast_id as string | null) ?? null,
  };
}

const checklistFromRow = (r: Row): ChecklistItem => ({
  id: r.id as string, decisionId: r.decision_id as string, team: r.team as ChecklistItem['team'], text: r.text as string,
  dueAt: (r.due_at as string | null) ?? null, done: r.done as boolean, doneBy: (r.done_by as string | null) ?? null, doneAt: (r.done_at as string | null) ?? null,
});

const announcementFromRow = (r: Row): Announcement => ({
  id: r.id as string, decisionId: r.decision_id as string, draft: r.draft as string,
  editedText: (r.edited_text as string | null) ?? null, updatedAt: r.updated_at as string,
});

const estimateFromRow = (r: EstimateRow): Estimate => ({
  key: r.key, disruptionId: r.disruption_id, likely: r.likely, low: r.low, high: r.high, unit: r.unit, reasoning: r.reasoning,
  confidence: r.confidence, model: r.model, createdAt: r.created_at, clamped: r.clamped,
});

/** The provider methods for AI, decisions, data sources and assumptions (everything except Early Warning, inputs and auth). */
export function createDataMethods(client: SupabaseClient, invoke: Invoke, deps: {
  getInputBundle: DataProvider['getInputBundle'];
  currentUser: DataProvider['currentUser'];
  emitBaseline: () => void;
}): DataMethods {
  /** One write that must touch a row; an empty result means row-level security blocked it. */
  async function writeOne(table: string, thing: string, id: string, patch: Row, select: string): Promise<Row> {
    const { data, error } = await client.from(table).update(patch).eq('id', id).select(select);
    if (error) throw toProviderError(error, thing);
    if (!data || data.length === 0) throw forbiddenWrite(thing);
    return data[0] as unknown as Row;
  }

  async function rowsOf(query: PromiseLike<{ data: unknown; error: unknown }>, thing: string): Promise<Row[]> {
    const { data, error } = await query;
    if (error) throw toProviderError(error, thing);
    return (data ?? []) as Row[];
  }

  async function forecastFor(decision: Decision): Promise<Forecast | null> {
    if (decision.forecastId === null) return null;
    const { data, error } = await client.from('forecasts').select('per_step, summary, levers, engine_version').eq('id', decision.forecastId).maybeSingle();
    if (error) throw toProviderError(error, 'that forecast');
    if (!data) return null;
    let context: Forecast['context'];
    try {
      context = (await deps.getInputBundle({ date: decision.contextDate, disruptionId: decision.disruptionId ?? undefined })).context;
    } catch {
      return null;   // a decision stays readable when its inputs cannot be rebuilt
    }
    const perStep = data.per_step as Pick<Forecast, 'metrics' | 'perBlock'>;
    return {
      engineVersion: data.engine_version as string, context, levers: data.levers as LeverSet, metrics: perStep.metrics, perBlock: perStep.perBlock,
      summary: data.summary as Summary, risk: null, warnings: [],
    };
  }

  async function latestRun(job: string, onlySuccess: boolean): Promise<Row | null> {
    let q = client.from('job_runs').select('*').eq('job_name', job);
    if (onlySuccess) q = q.eq('status', 'success');
    const { data, error } = await q.order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw toProviderError(error, 'source history');
    return (data as Row | null) ?? null;
  }

  return {
    async refreshEstimates(ctx) {
      const bundle = await deps.getInputBundle(ctx);
      const targets = bundle.context.disruptions.filter((d) => ESTIMATED_KINDS.includes(d.kind));
      const settled = await Promise.allSettled(targets.map((d) =>
        invoke<{ estimates: Estimate[]; stale?: boolean }>('ai-estimate', { date: ctx.date, disruptionId: d.id }, 'estimates')));
      const replies = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []));
      // A failure with nothing to show is an error; with some results, show them flagged as possibly out of date.
      if (targets.length > 0 && replies.length === 0) {
        const first = settled[0] as PromiseRejectedResult;
        if (first.reason instanceof ProviderError && first.reason.code === 'forbidden') throw first.reason;
        throw new ProviderError('unavailable', 'AI estimates are unavailable right now.');
      }
      const merged = replies.flatMap((r) => r.estimates);
      return replies.length < settled.length || replies.some((r) => r.stale === true) ? markStale(merged) : merged;
    },
    ask: (question, ctx, levers) => invoke('ai-ask', { question, context: ctx, levers }, 'scenarios'),
    async explain(ctx, levers, noAction, withPlan) {
      return (await invoke<{ text: string }>('ai-explain', { context: ctx, levers, noAction, withPlan }, 'scenarios')).text;
    },
    async generatePlans(ctx, budgetRm) {
      return (await invoke<{ plans: PlanProposal[] }>('ai-plans', { context: ctx, budgetRm }, 'plans')).plans;
    },
    async draftAnnouncement(plan, ctx, checklist) {
      return (await invoke<{ draft: string }>('ai-announcement', { plan, context: ctx, checklist }, 'announcements')).draft;
    },
    saveForecast: (ctx, levers) => invoke('forecast-save', { context: ctx, levers }, 'forecasts'),

    async createDecision(input) {
      const bundle = await invoke<DecisionBundle>('decision-create', {
        planId: input.plan.id, context: input.ctx, notes: input.notes, announcementText: input.announcementText,
      }, 'decisions');
      const user = await deps.currentUser().catch(() => null);   // the function returns the user id; pages show a name
      return user ? { ...bundle, decision: { ...bundle.decision, decidedBy: user.displayName } } : bundle;
    },
    async listDecisions() {
      return (await rowsOf(client.from('decisions').select(DECISION_SELECT).order('decided_at', { ascending: false }), 'decisions')).map(decisionFromRow);
    },
    async getDecision(id) {
      const { data, error } = await client.from('decisions').select(DECISION_SELECT).eq('id', id).maybeSingle();
      if (error) throw toProviderError(error, 'that decision');
      if (!data) return null;
      const decision = decisionFromRow(data as Row);
      const [items, announcement, forecast] = await Promise.all([
        rowsOf(client.from('checklist_items').select('*').eq('decision_id', id).order('sort'), 'the checklist'),
        rowsOf(client.from('announcements').select('*').eq('decision_id', id), 'the announcement'),
        forecastFor(decision),
      ]);
      if (announcement.length === 0) throw new ProviderError('not_found', 'Couldn’t find the announcement for that decision.');
      return { decision, checklist: items.map(checklistFromRow), announcement: announcementFromRow(announcement[0]), forecast };
    },
    async updateDecision(id, patch) {
      const change: Row = {};
      if (patch.status !== undefined) change.status = patch.status;
      if (patch.notes !== undefined) change.notes = patch.notes;
      return decisionFromRow(await writeOne('decisions', 'decisions', id, change, DECISION_SELECT));
    },
    async setChecklistItemDone(id, done) {
      const user = done ? await deps.currentUser() : null;
      return checklistFromRow(await writeOne('checklist_items', 'the checklist', id, {
        done, done_by: done ? user?.id ?? null : null, done_at: done ? new Date().toISOString() : null,
      }, '*'));
    },
    async updateAnnouncement(id, text) {
      return announcementFromRow(await writeOne('announcements', 'announcements', id, { edited_text: text, updated_at: new Date().toISOString() }, '*'));
    },

    async listSources() {
      const [sources, baseline] = await Promise.all([
        rowsOf(client.from('sources').select('*').order('name'), 'sources'),
        rowsOf(client.from('baseline_values').select('source_id, updated_at'), 'baseline values'),
      ]);
      const baselineAt = new Map<string, string>();
      for (const b of baseline) {
        const prev = baselineAt.get(b.source_id as string);
        if (prev === undefined || Date.parse(b.updated_at as string) > Date.parse(prev)) baselineAt.set(b.source_id as string, b.updated_at as string);
      }
      const now = new Date();
      return Promise.all(sources.map(async (r): Promise<SourceInfo> => {
        const s = r as unknown as SourceRow;
        let state: ReturnType<typeof sourceStatus>;
        if (s.job_name === null) {
          state = { status: 'static', lastUpdated: baselineAt.get(s.id) ?? null, ageHours: null };
        } else {
          const [latest, success] = await Promise.all([latestRun(s.job_name, false), latestRun(s.job_name, true)]);
          const run: LatestRun | null = latest && {
            status: latest.status as string, startedAt: latest.started_at as string, finishedAt: (latest.finished_at as string | null) ?? null,
          };
          state = sourceStatus(s, run, success ? (success.finished_at ?? success.started_at) as string : null, now);
        }
        return { id: s.id, name: s.name, label: s.label, url: s.url, licence: s.licence, description: s.description, ...state };
      }));
    },
    async listBaselineTables() {
      return Promise.all(BASELINE_TABLES.map(async (t) => ({
        name: t.name, title: t.title, columns: t.columns.map((c) => c.name), rows: await rowsOf(client.from(t.name).select('*'), t.title),
      })));
    },
    async uploadBaselineCsv(table, csv, opts) {
      const report = await invoke<CsvReport>('baseline-import', { table, csv, markVerified: opts.markVerified }, 'baseline data');
      if (report.applied) deps.emitBaseline();
      return report;
    },
    async getCsvTemplate(table) {
      const { data, error } = await client.from(table).select('*').limit(1);
      if (error) throw toProviderError(error, 'the template');
      return csvTemplate(table, ((data ?? [])[0] ?? undefined) as Row | undefined);
    },
    async getSettings() {
      const { data, error } = await client.from('settings').select('value').eq('id', 1).single();
      if (error || !data) throw toProviderError(error, 'settings');
      return data.value as Settings;
    },
    async listEstimates() {
      const rows = await rowsOf(client.from('ai_estimates').select('*, disruptions(title)').order('created_at', { ascending: false }), 'estimates');
      const seen = new Set<string>();
      const out: EstimateView[] = [];
      for (const r of rows) {   // newest first: the first row per (disruption, key) is the latest
        const k = `${r.disruption_id as string}|${r.key as string}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const title = (r.disruptions as { title?: string } | null)?.title;
        out.push({ ...estimateFromRow(r as unknown as EstimateRow), date: r.date as string, disruptionTitle: title ?? (r.disruption_id as string) });
      }
      return out;
    },
  };
}
