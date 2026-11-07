import type { Estimate, InputBundle, LeverKind, LeverSet, RiskLevel } from '@engine/index.ts';
import { addDays, evaluatePlan, runForecast } from '@engine/index.ts';
import { assembleBundle, fetchBundleRows, memoryRowsClient, effectiveTimes, mytParts, typicalRidership } from '@bundle/assemble.ts';
import type { RowsClient } from '@bundle/assemble.ts';
import { BASELINE_TABLES, csvTemplate, validateBaselineCsv } from '@bundle/csv.ts';
import type { BaselineTableName } from '@bundle/csv.ts';
import { fridayPrayerRows, heavyRainRows } from '@bundle/rules.ts';
import type {
  BaselineValueRow, DisruptionRow, DisruptionSourceRow, EstimateRow, PrayerRow, RidershipRow, SettingsRow, SourceRow, TableName, WeatherRow,
} from '@bundle/rows.ts';
import { buildChecklist, dueAtIso } from '@plans/checklist.ts';
import { itemRisk } from '@plans/itemRisk.ts';
import type { ItemRisk } from '@plans/itemRisk.ts';
import { fixtureTables } from '@fixtures/rows/index.ts';
import type { DataProvider } from '../DataProvider.ts';
import type {
  Announcement, AppUser, ChecklistItem, Channel, ContextRequest, CsvReport, Decision, DecisionBundle, DisruptionFilter, DisruptionInput,
  EarlyWarningItem, EstimateView, OverridePatch, PlanProposal, ScanRun, SourceInfo, StationDay, Today,
} from '../types.ts';
import { createEmitter } from './events.ts';
import { matchScripted } from './scripted/ask.ts';
import { explainScripted } from './scripted/explain.ts';
import { scriptedPlans } from './scripted/plans.ts';
import { announcementScripted } from './scripted/announcement.ts';

export interface DemoProviderOptions {
  today?: string;
  latencyMs?: [number, number];
  tables?: Partial<Record<TableName, unknown[]>>;
}
export type DemoProvider = DataProvider & { __test: { insertDisruptionRow(row: DisruptionRow): void } };

const RULE_HORIZON_DAYS = 120;
const SCAN_DURATION_MS = 1500;
const DEMO_NOW_MIN = 9 * 60 + 30;
const DAY_MS = 86_400_000;
const STATION = 'SP17: Bukit Jalil';

const REFRESH_DURATION_MS = 1200;
const UNMATCHED_RESTATEMENT = 'Live Gemini answers arrive with the full prototype. Try one of the suggested questions.';
const PRESENTER: AppUser = { id: 'presenter', displayName: 'Presenter', role: 'manager' };

/** Where each source's capture time lives in the fixture rows; sources with no such field get null (or the latest baseline_values row they own). */
const CAPTURE_FIELD: Partial<Record<string, [TableName, string]>> = {
  'apu-timetable': ['timetable_days', 'synced_at'],
  'open-meteo': ['weather_hourly', 'fetched_at'],
  esolat: ['prayer_times', 'fetched_at'],
  'google-routes': ['traffic_cache', 'fetched_at'],
  gemini: ['ai_estimates', 'created_at'],
};

const kindJson = (levers: LeverSet, kind: LeverKind): string => JSON.stringify(levers.filter((l) => l.kind === kind));

export function createDemoProvider(opts: DemoProviderOptions = {}): DemoProvider {
  const today = opts.today ?? import.meta.env.VITE_DEMO_TODAY ?? '2026-11-05';
  const [minLatency, maxLatency] = opts.latencyMs ?? [150, 400];
  const todayStartMs = Date.parse(`${today}T00:00:00+08:00`);
  const emitter = createEmitter();

  const tables = structuredClone({ ...fixtureTables, ...opts.tables }) as Record<TableName, unknown[]>;
  const disruptions = tables.disruptions as DisruptionRow[];
  disruptions.push(
    ...fridayPrayerRows(tables.prayer_times as PrayerRow[], today, addDays(today, RULE_HORIZON_DAYS)),
    ...heavyRainRows(tables.weather_hourly as WeatherRow[]),
  );
  const client = memoryRowsClient(tables);

  const riskCache = new Map<string, { risk: ItemRisk; computedAt: string }>();
  const scans: ScanRun[] = [];
  let nextId = 1;

  const forecasts = new Map<string, { id: string; ctx: ContextRequest; levers: LeverSet }>();
  const decisions: Decision[] = [];
  const decisionCtx = new Map<string, ContextRequest>();
  const checklists = new Map<string, ChecklistItem[]>();
  const announcements = new Map<string, Announcement>();
  const bundleFor = async (ctx: ContextRequest): Promise<InputBundle> =>
    assembleBundle(await fetchBundleRows(memoryRowsClient(tables), ctx.date), { reconstructed: ctx.reconstructed });
  const findDecision = (id: string): Decision => {
    const d = decisions.find((x) => x.id === id);
    if (!d) throw new Error(`decision not found: ${id}`);
    return d;
  };
  const titleOf = (id: string | undefined): string | null =>
    (id === undefined ? null : disruptions.find((d) => d.id === id)?.title ?? null);

  const delay = async (): Promise<void> => {
    if (maxLatency <= 0) return;
    await new Promise((r) => setTimeout(r, minLatency + Math.random() * (maxLatency - minLatency)));
  };
  const find = (id: string): DisruptionRow => {
    const row = disruptions.find((d) => d.id === id);
    if (!row) throw new Error(`disruption not found: ${id}`);
    return row;
  };

  async function riskOf(row: DisruptionRow, c: RowsClient = client): Promise<{ risk: ItemRisk; computedAt: string }> {
    const key = `${row.id}|${row.updated_at}`;
    let hit = riskCache.get(key);
    if (!hit) {
      hit = { risk: await itemRisk(c, row), computedAt: new Date().toISOString() };
      riskCache.set(key, hit);
    }
    return hit;
  }

  /** A client that sees `candidate` in place of the stored row of the same id, so risk can be computed before committing. */
  const clientWith = (candidate: DisruptionRow): RowsClient =>
    memoryRowsClient({ ...tables, disruptions: [...disruptions.filter((d) => d.id !== candidate.id), candidate] });

  /** The item for a row; a row whose risk cannot be computed is shown without risk instead of failing its caller. */
  async function toItem(row: DisruptionRow): Promise<EarlyWarningItem> {
    try {
      return buildItem(row, await riskOf(row));
    } catch {
      return buildItem(row, null);
    }
  }

  function buildItem(row: DisruptionRow, computed: { risk: ItemRisk; computedAt: string } | null): EarlyWarningItem {
    const t = effectiveTimes(row);
    const overridden = row.override_start_at !== null || row.override_end_at !== null || row.override_attendance !== null;
    const sources = (tables.disruption_sources as DisruptionSourceRow[]).filter((s) => s.disruption_id === row.id)
      .map((s) => ({ url: s.url, title: s.title, publishedAt: s.published_at }));
    return {
      id: row.id, title: row.title, type: row.type, kind: row.kind, venue: row.venue, startAt: t.start_at, endAt: t.end_at,
      expectedAttendance: t.expected_attendance,
      attendanceLabel: row.override_attendance !== null ? 'verified' : row.attendance_label,
      origin: row.origin, status: row.status,
      override: overridden
        ? { startAt: row.override_start_at, endAt: row.override_end_at, expectedAttendance: row.override_attendance, by: row.overridden_by, at: row.overridden_at }
        : null,
      riskLevel: computed?.risk.level ?? null, riskReason: computed?.risk.reason ?? null, riskComputedAt: computed?.computedAt ?? null,
      topPeaks: computed?.risk.peaks ?? [],
      sources, notes: row.notes,
      daysRemaining: Math.round((Date.parse(`${mytParts(t.start_at).date}T00:00:00+08:00`) - todayStartMs) / DAY_MS),
      isPast: Date.parse(t.end_at) < todayStartMs,
    };
  }

  async function listDisruptions(f: DisruptionFilter): Promise<EarlyWarningItem[]> {
    await delay();
    const rows = disruptions.filter((row) => {
      const t = effectiveTimes(row);
      const startMs = Date.parse(t.start_at);
      const endMs = Date.parse(t.end_at);
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false;
      if (mytParts(t.start_at).date > f.to || mytParts(new Date(endMs - 1).toISOString()).date < f.from) return false;
      if (row.status === 'dismissed' && !f.includeDismissed) return false;
      if (Date.parse(t.end_at) < todayStartMs && !f.includePast) return false;
      return !f.types || f.types.includes(row.type);
    });
    const items = await Promise.all(rows.map(toItem));
    const wanted: RiskLevel[] | undefined = f.risks;
    return items.filter((i) => !wanted || (i.riskLevel !== null && wanted.includes(i.riskLevel)))
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  }

  // Strictly increasing, so the id + updated_at risk cache key never collides within one millisecond.
  let lastStamp = 0;
  const touch = (row: DisruptionRow): void => {
    lastStamp = Math.max(Date.now(), lastStamp + 1);
    row.updated_at = new Date(lastStamp).toISOString();
  };
  const validate = (input: DisruptionInput): void => {
    if (input.title.trim() === '') throw new Error('title is required');
    const start = Date.parse(input.startAt);
    const end = Date.parse(input.endAt);
    if (Number.isNaN(start) || Number.isNaN(end)) throw new Error('start and end must be valid ISO timestamps');
    if (end <= start) throw new Error('end must be after start');
  };
  const applyInput = (row: DisruptionRow, input: DisruptionInput): void => {
    Object.assign(row, {
      title: input.title, type: input.type, kind: input.kind, venue: input.venue, start_at: input.startAt, end_at: input.endAt,
      expected_attendance: input.expectedAttendance, notes: input.notes,
    });
    touch(row);
  };

  const provider: DataProvider = {
    info: { kind: 'demo', dataNote: 'Demo data: a fixed snapshot of campus data, not live.' },
    async getToday(): Promise<Today> { await delay(); return { date: today, nowMin: DEMO_NOW_MIN }; },
    listDisruptions,
    async getDisruption(id) {
      await delay();
      const row = disruptions.find((d) => d.id === id);
      return row ? toItem(row) : null;
    },
    async createDisruption(input) {
      await delay();
      validate(input);
      const row: DisruptionRow = {
        id: `manual-${nextId++}-${Date.now().toString(36)}`, title: '', type: input.type, kind: input.kind, venue: null, start_at: '', end_at: '',
        expected_attendance: null, attendance_label: input.expectedAttendance === null ? null : 'baseline', origin: 'manual',
        override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
        status: 'active', risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null,
        notes: null, dedupe_key: null, created_by: 'presenter', updated_at: '',
      };
      applyInput(row, input);
      const computed = await riskOf(row, clientWith(row));   // throws before anything is stored
      disruptions.push(row);
      emitter.emit('disruptions');
      return buildItem(row, computed);
    },
    async updateDisruption(id, input) {
      await delay();
      const row = find(id);
      if (row.origin !== 'manual') throw new Error('only manual disruptions can be edited');
      validate(input);
      const candidate = { ...row };
      applyInput(candidate, input);
      const computed = await riskOf(candidate, clientWith(candidate));
      Object.assign(row, candidate);
      emitter.emit('disruptions');
      return buildItem(row, computed);
    },
    async deleteDisruption(id) {
      await delay();
      const row = find(id);
      if (row.origin !== 'manual') throw new Error('only manual disruptions can be deleted');
      disruptions.splice(disruptions.indexOf(row), 1);
      emitter.emit('disruptions');
    },
    async dismissDisruption(id) {
      await delay();
      const row = find(id);
      if (row.origin === 'manual') throw new Error('manual disruptions are deleted, not dismissed');
      row.status = 'dismissed';
      touch(row);
      emitter.emit('disruptions');
    },
    async overrideDisruption(id, patch: OverridePatch) {
      await delay();
      const row = find(id);
      if (row.origin !== 'scan') throw new Error('only scanned disruptions can be overridden');
      const candidate = { ...row };
      if (patch.startAt !== undefined) candidate.override_start_at = patch.startAt;
      if (patch.endAt !== undefined) candidate.override_end_at = patch.endAt;
      if (patch.expectedAttendance !== undefined) candidate.override_attendance = patch.expectedAttendance;
      const t = effectiveTimes(candidate);
      if (Number.isNaN(Date.parse(t.start_at)) || Number.isNaN(Date.parse(t.end_at)) || Date.parse(t.end_at) <= Date.parse(t.start_at)) {
        throw new Error('override must give a valid start before the end');
      }
      candidate.overridden_by = 'presenter';
      candidate.overridden_at = new Date().toISOString();
      touch(candidate);
      const computed = await riskOf(candidate, clientWith(candidate));
      Object.assign(row, candidate);
      emitter.emit('disruptions');
      return buildItem(row, computed);
    },
    async triggerScan() {
      const startedAt = new Date().toISOString();
      await new Promise((r) => setTimeout(r, SCAN_DURATION_MS));
      const run: ScanRun = {
        id: `scan-run-${nextId++}`, startedAt, finishedAt: new Date().toISOString(), status: 'success', method: 'fixture',
        itemsFound: disruptions.filter((d) => d.origin === 'scan').length, itemsChanged: 0, errorSummary: null,
      };
      scans.push(run);
      emitter.emit('job_runs');
      return run;
    },
    async getLatestScan() { await delay(); return scans[scans.length - 1] ?? null; },
    subscribe(channel: Channel, handler) { return emitter.on(channel, handler); },
    async getInputBundle(ctx) { await delay(); return bundleFor(ctx); },
    async refreshEstimates(ctx) {
      await new Promise((r) => setTimeout(r, REFRESH_DURATION_MS));
      return (await bundleFor(ctx)).estimates;
    },
    async ask(question, _ctx, levers) {
      await delay();
      const hit = matchScripted(question);
      if (!hit) return { matched: false, levers, restatement: UNMATCHED_RESTATEMENT, changedKinds: [] };
      const kinds = [...new Set([...levers, ...hit.levers].map((l) => l.kind))];
      return {
        matched: true, levers: structuredClone(hit.levers), restatement: hit.restatement,
        changedKinds: kinds.filter((k) => kindJson(levers, k) !== kindJson(hit.levers, k)),
      };
    },
    async explain(_ctx, _levers, noAction, withPlan) { await delay(); return explainScripted(noAction, withPlan); },
    async generatePlans(ctx, budgetRm) {
      await delay();
      const bundle = await bundleFor(ctx);
      return scriptedPlans(ctx, bundle.context.dayType).map((p, i): PlanProposal => {
        const { noAction, withPlan, overBudget } = evaluatePlan(bundle, p.levers, budgetRm);
        return {
          id: `plan-${ctx.date}-${i + 1}`, name: p.name, levers: p.levers, rationale: p.rationale,
          costLines: withPlan.summary.costLines, totalCostRm: withPlan.summary.totalCostRm,
          summary: withPlan.summary, noActionSummary: noAction.summary, overBudget, budgetRm,
        };
      });
    },
    async draftAnnouncement(plan, ctx, checklist) {
      await delay();
      return announcementScripted(plan, ctx, titleOf(ctx.disruptionId), checklist);
    },
    async saveForecast(ctx, levers) {
      await delay();
      const id = `fc-${nextId++}`;
      forecasts.set(id, { id, ctx, levers: structuredClone(levers) });
      return { id };
    },
    async createDecision(input): Promise<DecisionBundle> {
      await delay();
      const { plan, ctx } = input;
      const drafts = buildChecklist(plan.levers, await bundleFor(ctx));   // may throw; nothing is stored until it succeeds
      const decidedAt = new Date().toISOString();
      const id = `dec-${nextId++}`;
      const decision: Decision = {
        id, planId: plan.id, planName: plan.name, disruptionId: ctx.disruptionId ?? null, contextDate: ctx.date, decidedBy: 'Presenter',
        decidedAt, status: 'planned', notes: input.notes, totalCostRm: plan.totalCostRm, predicted: structuredClone(plan.summary),
        levers: structuredClone(plan.levers), forecastId: null,
      };
      const checklist: ChecklistItem[] = drafts.map((d) => ({
        id: `chk-${nextId++}`, decisionId: id, team: d.team, text: d.text, dueAt: dueAtIso(ctx.date, d.dueMin), done: false, doneBy: null, doneAt: null,
      }));
      const announcement: Announcement = { id: `ann-${nextId++}`, decisionId: id, draft: input.announcementText, editedText: null, updatedAt: decidedAt };
      decisions.push(decision);
      decisionCtx.set(id, ctx);
      checklists.set(id, checklist);
      announcements.set(id, announcement);
      emitter.emit('decisions');
      return structuredClone({ decision, checklist, announcement });
    },
    async listDecisions() { await delay(); return structuredClone([...decisions].reverse()); },
    async getDecision(id) {
      await delay();
      const decision = decisions.find((d) => d.id === id);
      if (!decision) return null;
      let forecast = null;
      try {
        forecast = runForecast(await bundleFor(decisionCtx.get(id)!), decision.levers);
      } catch { /* a decision stays readable when its forecast cannot be recomputed */ }
      return structuredClone({ decision, checklist: checklists.get(id)!, announcement: announcements.get(id)!, forecast });
    },
    async updateDecision(id, patch) {
      await delay();
      const decision = findDecision(id);
      if (patch.status !== undefined) decision.status = patch.status;
      if (patch.notes !== undefined) decision.notes = patch.notes;
      emitter.emit('decisions');
      return structuredClone(decision);
    },
    async setChecklistItemDone(id, done) {
      await delay();
      const item = [...checklists.values()].flat().find((c) => c.id === id);
      if (!item) throw new Error(`checklist item not found: ${id}`);
      item.done = done;
      item.doneBy = done ? 'Presenter' : null;
      item.doneAt = done ? new Date().toISOString() : null;
      emitter.emit('checklist_items');
      return structuredClone(item);
    },
    async updateAnnouncement(id, text) {
      await delay();
      const announcement = [...announcements.values()].find((a) => a.id === id);
      if (!announcement) throw new Error(`announcement not found: ${id}`);
      announcement.editedText = text;
      announcement.updatedAt = new Date().toISOString();
      emitter.emit('decisions');
      return structuredClone(announcement);
    },
    async listSources() {
      await delay();
      const latest = (rows: Record<string, unknown>[], field: string): string | null =>
        rows.map((r) => r[field]).filter((v): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v)))
          .reduce<string | null>((best, v) => (best === null || Date.parse(v) > Date.parse(best) ? v : best), null);
      return (tables.sources as SourceRow[]).map((s): SourceInfo => {
        const field = CAPTURE_FIELD[s.id];
        const rows = field
          ? tables[field[0]] as Record<string, unknown>[]
          : (tables.baseline_values as BaselineValueRow[]).filter((r) => r.source_id === s.id) as unknown as Record<string, unknown>[];
        return {
          id: s.id, name: s.name, label: s.label, url: s.url, licence: s.licence, description: s.description,
          lastUpdated: latest(rows, field ? field[1] : 'updated_at'), status: 'static', ageHours: null,
        };
      });
    },
    async listBaselineTables() {
      await delay();
      return BASELINE_TABLES.map((t) => ({
        name: t.name, title: t.title, columns: t.columns.map((c) => c.name), rows: structuredClone(tables[t.name]) as Record<string, unknown>[],
      }));
    },
    async uploadBaselineCsv(table: BaselineTableName, csv: string, opts): Promise<CsvReport> {
      await delay();
      const spec = BASELINE_TABLES.find((t) => t.name === table)!;
      const existing = tables[table] as Record<string, unknown>[];
      const { rows, errors } = validateBaselineCsv(table, csv, { existingKeys: (tables.baseline_values as BaselineValueRow[]).map((r) => r.key) });
      if (errors.length > 0) return { ok: false, applied: false, rowCount: 0, errors };
      const label = opts.markVerified ? 'verified' : 'baseline';
      let next: Record<string, unknown>[];
      if (spec.mode === 'upsert_by_key') {
        const stamp = new Date().toISOString();
        next = existing.map((old) => {
          const hit = rows.find((r) => r.key === old.key);
          return hit ? { ...old, value: hit.value, unit: hit.unit, description: hit.description, label, updated_at: stamp } : old;
        });
      } else {
        next = rows.map((r) => (table === 'rooms' ? { ...r, seats_label: label } : { ...r, label }));
      }
      try {   // the new rows must still assemble into a bundle before they replace the old ones
        assembleBundle(await fetchBundleRows(memoryRowsClient({ ...tables, [table]: next }), today));
      } catch (e) {
        const message = `These rows cannot be used: ${e instanceof Error ? e.message : String(e)}`;
        return { ok: false, applied: false, rowCount: 0, errors: [{ row: 1, column: null, message }] };
      }
      tables[table] = next;
      riskCache.clear();
      emitter.emit('baseline');
      return { ok: true, applied: true, rowCount: rows.length, errors: [] };
    },
    async getCsvTemplate(table) {
      await delay();
      return csvTemplate(table, (tables[table][0] ?? undefined) as Record<string, unknown> | undefined);
    },
    async getSettings() { await delay(); return structuredClone((tables.settings as SettingsRow[])[0].value); },
    async listEstimates() {
      await delay();
      return (tables.ai_estimates as EstimateRow[]).map((r): EstimateView & Estimate => ({
        key: r.key, disruptionId: r.disruption_id, likely: r.likely, low: r.low, high: r.high, unit: r.unit, reasoning: r.reasoning,
        confidence: r.confidence, model: r.model, createdAt: r.created_at, clamped: r.clamped,
        date: r.date, disruptionTitle: titleOf(r.disruption_id) ?? r.disruption_id,
      }));
    },
    async getStationDay(date): Promise<StationDay | null> {
      await delay();
      const rows = tables.lrt_ridership_daily as RidershipRow[];
      const row = rows.find((r) => r.date === date && r.station === STATION);
      if (!row) return null;
      const typical = typicalRidership(rows, date);
      return {
        date, boardings: row.boardings, alightings: row.alightings,
        typicalBoardings: typical?.typicalDailyBoardings.value ?? null, typicalAlightings: typical?.typicalDailyAlightings.value ?? null,
      };
    },
    async currentUser() { return { ...PRESENTER }; },
    async signIn() { return { ...PRESENTER }; },
    async demoSignIn() { return { ...PRESENTER }; },
    async signOut() { /* nothing to end in demo mode */ },
  };

  return Object.assign(provider, {
    __test: { insertDisruptionRow(row: DisruptionRow): void { disruptions.push(row); } },
  });
}
