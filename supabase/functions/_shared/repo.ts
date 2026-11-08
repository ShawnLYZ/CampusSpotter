import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { memoryRowsClient } from './bundle.ts';
import type { BaselineValueRow, EstimateRow, RowFilter, RowsClient, TableName } from './bundle.ts';
import type {
  DisruptionRow, DisruptionSourceRow, PrayerRow, RidershipRow, RoomRow, TimetableConditionedRow, TimetableDayRow, TimetableGroupRow, TrafficRow, WeatherRow,
} from '../../../shared/bundle/rows.ts';
import type { DisruptionKind, RiskLevel } from '../../../shared/engine/types.ts';

// Row shapes mirror supabase/migrations/20261105000002_core_tables.sql.
export interface PlanRowInput {
  context_date: string; disruption_id: string | null; name: string; levers: unknown; rationale: string; cost_lines: unknown;
  total_cost_rm: number; summary: unknown; no_action_summary: unknown; budget_rm: number; over_budget: boolean; created_by?: string | null;
}
export interface PlanRow extends PlanRowInput { id: string; generated_at: string; created_by: string | null }
export interface ForecastRowInput {
  context_date: string; disruption_id: string | null; scenario_kind: 'no_action' | 'plan'; levers: unknown; summary: unknown; per_step: unknown;
  input_snapshot_hash: string; engine_version: string; created_by?: string | null;
}
export interface DecisionRowInput {
  plan_id: string | null; forecast_id: string | null; disruption_id: string | null; context_date: string; plan_name: string; levers: unknown;
  predicted: unknown; total_cost_rm: number; decided_by?: string | null; notes?: string | null;
}
export interface DecisionRow extends DecisionRowInput {
  id: string; decided_by: string | null; decided_at: string; status: 'planned' | 'done' | 'cancelled'; notes: string | null;
}
export interface ChecklistRowInput { decision_id: string; team: 'transport' | 'facilities' | 'cafeteria' | 'academic'; text: string; due_at: string | null; sort: number }
export interface ChecklistRow extends ChecklistRowInput { id: string; done: boolean; done_by: string | null; done_at: string | null }
export interface AnnouncementRow { id: string; decision_id: string; draft: string; edited_text: string | null; updated_at: string }

/** A failed repo operation. `what` is a fixed label (safe to log); the message may echo stored or user text, so never log it. */
export class RepoError extends Error {
  what: string;
  constructor(what: string, message: string) {
    super(`${what}: ${message}`);
    this.name = 'RepoError';
    this.what = what;
  }
}

export interface JobRun {
  id: number; startedAt: string; status: string; itemsFound: number; itemsChanged: number; method: string | null; errorSummary: string | null;
}
export interface DisruptionFilter {
  fromIso: string; toIso: string; origins?: ('scan' | 'manual' | 'rule')[]; kinds?: DisruptionKind[]; includeDismissed?: boolean;
}
export type RuleKind = 'friday_prayer' | 'heavy_rain';

export interface Repo {
  rows: RowsClient;
  userFromJwt(jwt: string): Promise<{ id: string } | null>;
  roleOf(userId: string): Promise<'manager' | 'demo' | null>;
  getCache(hash: string): Promise<unknown | null>;
  setCache(hash: string, fn: string, response: unknown): Promise<void>;
  getEstimatesByHash(hash: string): Promise<EstimateRow[]>;
  latestEstimatesFor(disruptionId: string): Promise<EstimateRow[]>;
  insertEstimates(rows: EstimateRow[]): Promise<void>;
  insertPlans(rows: PlanRowInput[]): Promise<{ id: string }[]>;
  getPlan(id: string): Promise<PlanRow | null>;
  insertForecast(row: ForecastRowInput): Promise<{ id: string }>;
  insertDecision(row: DecisionRowInput): Promise<DecisionRow>;
  deleteDecision(id: string): Promise<void>;
  insertChecklist(rows: ChecklistRowInput[]): Promise<ChecklistRow[]>;
  insertAnnouncement(row: { decision_id: string; draft: string }): Promise<AnnouncementRow>;
  upsertBaselineValues(rows: BaselineValueRow[], by: string): Promise<number>;
  replaceTable(table: 'rooms' | 'cafeteria_outlets' | 'energy_profiles' | 'waiting_halls', rows: Record<string, unknown>[]): Promise<number>;
  startJob(name: string, method?: string): Promise<number>;
  finishJob(id: number, patch: { status: 'success' | 'failed'; itemsFound?: number; itemsChanged?: number; errorSummary?: string | null; method?: string }): Promise<void>;
  latestJob(name: string): Promise<JobRun | null>;
  /** Closes this job's 'running' rows started before `olderThanIso` as failed with error_summary 'interrupted'. Returns the count. */
  failStaleJobs(name: string, olderThanIso: string): Promise<number>;
  /** Upserts the new rows, then prunes rows of the given dates that are not among them, so a failed write leaves the previous rows intact. */
  replaceTimetable(dates: string[], days: TimetableDayRow[], groups: TimetableGroupRow[], conditioned: TimetableConditionedRow[]): Promise<void>;
  /** Insert-only: rooms already present (possibly CSV-edited) are kept. Returns the number of rows offered. */
  insertMissingRooms(rooms: RoomRow[]): Promise<number>;
  upsertPrayer(rows: PrayerRow[]): Promise<number>;
  upsertWeather(rows: WeatherRow[]): Promise<number>;
  upsertTraffic(rows: TrafficRow[]): Promise<number>;
  upsertRidership(rows: RidershipRow[]): Promise<number>;
  incrementApiUsage(service: string, month: string, n: number): Promise<number>;
  listDisruptions(filter: DisruptionFilter): Promise<DisruptionRow[]>;
  /** Upserts rule rows of `kind`; deletes origin 'rule' rows of that kind starting in [fromIso, toIso) that are not in `rows`. */
  upsertRuleDisruptions(kind: RuleKind, rows: DisruptionRow[], window: { fromIso: string; toIso: string }): Promise<{ inserted: number; updated: number; deleted: number }>;
  /** Matches by dedupe_key. An existing row only gets its scan-owned fields refreshed; overrides, status, origin and created_by are kept. */
  upsertScannedDisruption(row: DisruptionRow, sources: DisruptionSourceRow[]): Promise<'inserted' | 'updated' | 'unchanged'>;
  updateRisk(id: string, risk: { level: RiskLevel; reason: string; peaks: unknown; computedAt: string }): Promise<void>;
}

/** Fields a scan may refresh on an existing row. Notes belong to managers, so a scan never sets or compares them. */
const SCAN_FIELDS = ['title', 'venue', 'start_at', 'end_at', 'expected_attendance', 'attendance_label'] as const;
const sameScanValue = (field: string, a: unknown, b: unknown): boolean =>
  field === 'start_at' || field === 'end_at' ? Date.parse(String(a)) === Date.parse(String(b)) : (a ?? null) === (b ?? null);
const scanChanged = (existing: DisruptionRow, row: DisruptionRow): boolean => SCAN_FIELDS.some((f) => !sameScanValue(f, existing[f], row[f]));
/** Columns a rule refresh must not reset: risk, dismissal and overrides survive it. */
const RULE_KEEP = ['status', 'risk_level', 'risk_reason', 'risk_peaks', 'risk_computed_at', 'override_start_at', 'override_end_at', 'override_attendance', 'overridden_by', 'overridden_at', 'created_by'] as const;
const inWindow = (iso: string, w: { fromIso: string; toIso: string }): boolean => Date.parse(iso) >= Date.parse(w.fromIso) && Date.parse(iso) < Date.parse(w.toIso);

interface JobRunRow { id: number; started_at: string; status: string; items_found: number; items_changed: number; method: string | null; error_summary: string | null }
const toJobRun = (r: JobRunRow): JobRun => ({
  id: r.id, startedAt: r.started_at, status: r.status, itemsFound: r.items_found, itemsChanged: r.items_changed, method: r.method, errorSummary: r.error_summary,
});

const TIMETABLE_TABLES = [
  { table: 'timetable_days', key: ['date'], pick: (x: { days: unknown[] }) => x.days },
  { table: 'timetable_groups', key: ['date', 'block', 'room_type', 'start_min', 'end_min'], pick: (x: { groups: unknown[] }) => x.groups },
  { table: 'timetable_conditioned', key: ['date', 'block', 'room_type', 'step'], pick: (x: { conditioned: unknown[] }) => x.conditioned },
] as const;
const PAGE_SIZE = 1000;
const DELETE_BATCH = 20;
const keyOf = (r: Record<string, unknown>, key: readonly string[]): string => key.map((k) => String(r[k])).join('|');

const REPLACE_KEY: Record<string, string> = { rooms: 'code', cafeteria_outlets: 'id', energy_profiles: 'block', waiting_halls: 'id' };

/** The estimates sharing the most recently created context_hash. */
function latestGroup(rows: EstimateRow[]): EstimateRow[] {
  if (rows.length === 0) return [];
  const newest = rows.reduce((a, b) => (b.created_at > a.created_at ? b : a));
  return rows.filter((r) => r.context_hash === newest.context_hash);
}

export function createSupabaseRepo(admin: SupabaseClient): Repo {
  const must = <T>(res: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (res.error) throw new RepoError(what, res.error.message);
    return res.data as T;
  };
  const rows: RowsClient = {
    async select(table: TableName, filters: RowFilter[] = []) {
      let q = admin.from(table).select('*');
      for (const f of filters) {
        switch (f.op) {
          case 'eq': q = q.eq(f.column, f.value as never); break;
          case 'neq': q = q.neq(f.column, f.value as never); break;
          case 'gt': q = q.gt(f.column, f.value as never); break;
          case 'gte': q = q.gte(f.column, f.value as never); break;
          case 'lt': q = q.lt(f.column, f.value as never); break;
          case 'lte': q = q.lte(f.column, f.value as never); break;
          case 'in': q = q.in(f.column, f.value as never[]); break;
        }
      }
      return must(await q, `select ${table}`) ?? [];
    },
  };
  return {
    rows,
    async userFromJwt(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      return error || !data.user ? null : { id: data.user.id };
    },
    async roleOf(userId) {
      const { data, error } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (error) throw new Error(`roleOf: ${error.message}`);
      return (data?.role as 'manager' | 'demo' | undefined) ?? null;
    },
    async getCache(hash) {
      const { data, error } = await admin.from('ai_cache').select('response').eq('request_hash', hash).maybeSingle();
      if (error) throw new Error(`getCache: ${error.message}`);
      return data ? data.response : null;
    },
    async setCache(hash, fn, response) {
      must(await admin.from('ai_cache').upsert({ request_hash: hash, function: fn, response }, { onConflict: 'request_hash' }), 'setCache');
    },
    async getEstimatesByHash(hash) {
      return (must(await admin.from('ai_estimates').select('*').eq('context_hash', hash), 'getEstimatesByHash') ?? []) as EstimateRow[];
    },
    async latestEstimatesFor(disruptionId) {
      const all = (must(await admin.from('ai_estimates').select('*').eq('disruption_id', disruptionId), 'latestEstimatesFor') ?? []) as EstimateRow[];
      return latestGroup(all);
    },
    async insertEstimates(r) {
      if (r.length === 0) return;
      must(await admin.from('ai_estimates').upsert(r, { onConflict: 'context_hash,key' }), 'insertEstimates');
    },
    async insertPlans(r) {
      return must(await admin.from('plans').insert(r).select('id'), 'insertPlans') as { id: string }[];
    },
    async getPlan(id) {
      const { data, error } = await admin.from('plans').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(`getPlan: ${error.message}`);
      return (data as PlanRow | null) ?? null;
    },
    async insertForecast(row) {
      return must(await admin.from('forecasts').insert(row).select('id').single(), 'insertForecast') as { id: string };
    },
    async insertDecision(row) {
      return must(await admin.from('decisions').insert(row).select('*').single(), 'insertDecision') as DecisionRow;
    },
    async deleteDecision(id) {
      must(await admin.from('decisions').delete().eq('id', id), 'deleteDecision');
    },
    async insertChecklist(r) {
      return must(await admin.from('checklist_items').insert(r).select('*'), 'insertChecklist') as ChecklistRow[];
    },
    async insertAnnouncement(row) {
      return must(await admin.from('announcements').insert(row).select('*').single(), 'insertAnnouncement') as AnnouncementRow;
    },
    async upsertBaselineValues(r, by) {
      if (r.length === 0) return 0;
      const stamped = r.map((x) => ({ ...x, updated_by: by, updated_at: new Date().toISOString() }));
      must(await admin.from('baseline_values').upsert(stamped, { onConflict: 'key' }), 'upsertBaselineValues');
      return r.length;
    },
    async replaceTable(table, r) {
      const key = REPLACE_KEY[table];
      // Upsert first, then prune rows no longer present, so a failed write never empties the table.
      if (r.length > 0) must(await admin.from(table).upsert(r, { onConflict: key }), `replaceTable ${table}`);
      const keep = r.map((x) => String(x[key]).replaceAll('"', '\\"'));
      const del = admin.from(table).delete();
      const pruned = keep.length > 0 ? del.not(key, 'in', `(${keep.map((k) => `"${k}"`).join(',')})`) : del.not(key, 'is', null);
      must(await pruned, `replaceTable ${table} prune`);
      return r.length;
    },
    async startJob(name, method) {
      const row = must(await admin.from('job_runs').insert({ job_name: name, status: 'running', method: method ?? null }).select('id').single(), 'startJob') as { id: number };
      return row.id;
    },
    async finishJob(id, patch) {
      const upd: Record<string, unknown> = {
        status: patch.status, finished_at: new Date().toISOString(), items_found: patch.itemsFound ?? 0, items_changed: patch.itemsChanged ?? 0,
        error_summary: patch.errorSummary ?? null,
      };
      if (patch.method !== undefined) upd.method = patch.method;
      must(await admin.from('job_runs').update(upd).eq('id', id), 'finishJob');
    },
    async latestJob(name) {
      const { data, error } = await admin.from('job_runs').select('*').eq('job_name', name).order('started_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
      if (error) throw new RepoError('latestJob', error.message);
      return data ? toJobRun(data as JobRunRow) : null;
    },
    async failStaleJobs(name, olderThanIso) {
      const closed = must(
        await admin.from('job_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_summary: 'interrupted' })
          .eq('job_name', name).eq('status', 'running').lt('started_at', olderThanIso).select('id'),
        'failStaleJobs',
      ) as { id: number }[] | null;
      return closed?.length ?? 0;
    },
    async replaceTimetable(dates, days, groups, conditioned) {
      for (const spec of TIMETABLE_TABLES) {
        const next = spec.pick({ days, groups, conditioned }) as Record<string, unknown>[];
        if (next.length > 0) must(await admin.from(spec.table).upsert(next, { onConflict: spec.key.join(',') }), `replaceTimetable upsert ${spec.table}`);
      }
      if (dates.length === 0) return;
      for (const spec of TIMETABLE_TABLES) {
        const next = spec.pick({ days, groups, conditioned }) as Record<string, unknown>[];
        const keep = new Set(next.map((x) => keyOf(x, spec.key)));
        // Read the existing keys per date, in ordered pages, so PostgREST's max_rows cap never hides a stale row.
        const stale: Record<string, unknown>[] = [];
        for (const date of dates) {
          for (let from = 0; ; from += PAGE_SIZE) {
            let q = admin.from(spec.table).select(spec.key.join(',')).eq('date', date);
            for (const k of spec.key) q = q.order(k, { ascending: true });
            const page = (must(await q.range(from, from + PAGE_SIZE - 1), `replaceTimetable select ${spec.table}`) ?? []) as unknown as Record<string, unknown>[];
            stale.push(...page.filter((x) => !keep.has(keyOf(x, spec.key))));
            if (page.length < PAGE_SIZE) break;
          }
        }
        for (let c = 0; c < stale.length; c += DELETE_BATCH) {
          await Promise.all(stale.slice(c, c + DELETE_BATCH).map(async (row) => {
            must(await admin.from(spec.table).delete().match(Object.fromEntries(spec.key.map((k) => [k, row[k]]))), `replaceTimetable prune ${spec.table}`);
          }));
        }
      }
    },
    async insertMissingRooms(r) {
      if (r.length > 0) must(await admin.from('rooms').upsert(r, { onConflict: 'code', ignoreDuplicates: true }), 'insertMissingRooms');
      return r.length;
    },
    async upsertPrayer(r) {
      if (r.length > 0) must(await admin.from('prayer_times').upsert(r, { onConflict: 'date,zone' }), 'upsertPrayer');
      return r.length;
    },
    async upsertWeather(r) {
      if (r.length > 0) must(await admin.from('weather_hourly').upsert(r, { onConflict: 'time' }), 'upsertWeather');
      return r.length;
    },
    async upsertTraffic(r) {
      if (r.length > 0) must(await admin.from('traffic_cache').upsert(r, { onConflict: 'date,hour_index,direction,kind' }), 'upsertTraffic');
      return r.length;
    },
    async upsertRidership(r) {
      if (r.length > 0) must(await admin.from('lrt_ridership_daily').upsert(r, { onConflict: 'date,station' }), 'upsertRidership');
      return r.length;
    },
    async incrementApiUsage(service, month, n) {
      return must(await admin.rpc('increment_api_usage', { p_service: service, p_month: month, p_n: n }), 'incrementApiUsage') as number;
    },
    async listDisruptions(f) {
      let q = admin.from('disruptions').select('*').gte('start_at', f.fromIso).lt('start_at', f.toIso);
      if (!f.includeDismissed) q = q.eq('status', 'active');
      if (f.origins) q = q.in('origin', f.origins);
      if (f.kinds) q = q.in('kind', f.kinds);
      return (must(await q.order('start_at', { ascending: true }), 'listDisruptions') ?? []) as DisruptionRow[];
    },
    async upsertRuleDisruptions(kind, r, window) {
      const existing = (must(
        await admin.from('disruptions').select('id').eq('origin', 'rule').eq('kind', kind).gte('start_at', window.fromIso).lt('start_at', window.toIso),
        'upsertRuleDisruptions select',
      ) ?? []) as { id: string }[];
      const known = new Set(existing.map((e) => e.id));
      const keep = new Set(r.map((x) => x.id));
      const payload = r.map((x) => {
        const p: Record<string, unknown> = { ...x };
        for (const k of RULE_KEEP) delete p[k];
        return p;
      });
      if (payload.length > 0) must(await admin.from('disruptions').upsert(payload, { onConflict: 'id' }), 'upsertRuleDisruptions upsert');
      const stale = existing.map((e) => e.id).filter((id) => !keep.has(id));
      if (stale.length > 0) must(await admin.from('disruptions').delete().in('id', stale).eq('origin', 'rule'), 'upsertRuleDisruptions delete');
      return { inserted: r.filter((x) => !known.has(x.id)).length, updated: r.filter((x) => known.has(x.id)).length, deleted: stale.length };
    },
    async upsertScannedDisruption(row, sources) {
      const { data, error } = await admin.from('disruptions').select('*').eq('dedupe_key', row.dedupe_key).maybeSingle();
      if (error) throw new RepoError('upsertScannedDisruption select', error.message);
      let outcome: 'inserted' | 'updated' | 'unchanged';
      let id: string;
      if (!data) {
        must(await admin.from('disruptions').insert(row), 'upsertScannedDisruption insert');
        outcome = 'inserted';
        id = row.id;
      } else {
        const existing = data as DisruptionRow;
        id = existing.id;
        if (scanChanged(existing, row)) {
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          for (const f of SCAN_FIELDS) patch[f] = row[f];
          must(await admin.from('disruptions').update(patch).eq('id', id), 'upsertScannedDisruption update');
          outcome = 'updated';
        } else outcome = 'unchanged';
      }
      if (sources.length > 0) {
        must(await admin.from('disruption_sources').upsert(sources.map((s) => ({ ...s, disruption_id: id })), { onConflict: 'disruption_id,url' }), 'upsertScannedDisruption sources');
      }
      return outcome;
    },
    async updateRisk(id, risk) {
      must(await admin.from('disruptions').update({ risk_level: risk.level, risk_reason: risk.reason, risk_peaks: risk.peaks, risk_computed_at: risk.computedAt }).eq('id', id), 'updateRisk');
    },
  };
}

type MemoryTables = Partial<Record<TableName | 'plans' | 'forecasts' | 'decisions' | 'checklist_items' | 'announcements' | 'ai_cache' | 'profiles' | 'job_runs' | 'api_usage', unknown[]>>;

function upsertBy<T extends object>(list: T[], incoming: T[], key: (x: any) => string): void {
  for (const x of incoming) {
    const i = list.findIndex((e) => key(e) === key(x));
    if (i >= 0) list[i] = x; else list.push(x);
  }
}

export function createMemoryRepo(
  seed: MemoryTables = {},
  users: Record<string, { id: string; role: 'manager' | 'demo' }> = {},
): Repo & { tables: Record<string, unknown[]> } {
  const tables: Record<string, unknown[]> = {};
  for (const [k, v] of Object.entries(seed)) tables[k] = [...(v ?? [])];
  for (const n of ['plans', 'forecasts', 'decisions', 'checklist_items', 'announcements', 'ai_cache', 'profiles', 'ai_estimates', 'baseline_values', 'job_runs', 'api_usage', 'disruptions', 'disruption_sources', 'rooms', 'timetable_days', 'timetable_groups', 'timetable_conditioned', 'prayer_times', 'weather_hourly', 'traffic_cache', 'lrt_ridership_daily']) tables[n] ??= [];
  const profiles = tables.profiles as { id: string; role: 'manager' | 'demo' }[];
  for (const u of Object.values(users)) if (!profiles.some((p) => p.id === u.id)) profiles.push({ id: u.id, role: u.role });
  const now = () => new Date().toISOString();
  const t = <T>(name: string) => tables[name] as T[];
  const rows = memoryRowsClient(tables as Partial<Record<TableName, unknown[]>>);

  return {
    tables, rows,
    async userFromJwt(jwt) { const u = users[jwt]; return u ? { id: u.id } : null; },
    async roleOf(userId) { return profiles.find((p) => p.id === userId)?.role ?? null; },
    async getCache(hash) {
      const hit = t<{ request_hash: string; response: unknown }>('ai_cache').find((r) => r.request_hash === hash);
      return hit ? hit.response : null;
    },
    async setCache(hash, fn, response) {
      const list = t<{ request_hash: string; function: string; response: unknown; created_at: string }>('ai_cache');
      const i = list.findIndex((r) => r.request_hash === hash);
      const row = { request_hash: hash, function: fn, response, created_at: now() };
      if (i >= 0) list[i] = row; else list.push(row);
    },
    async getEstimatesByHash(hash) { return t<EstimateRow>('ai_estimates').filter((r) => r.context_hash === hash); },
    async latestEstimatesFor(disruptionId) { return latestGroup(t<EstimateRow>('ai_estimates').filter((r) => r.disruption_id === disruptionId)); },
    async insertEstimates(r) {
      const list = t<EstimateRow>('ai_estimates');
      for (const e of r) {
        const i = list.findIndex((x) => x.context_hash === e.context_hash && x.key === e.key);
        if (i >= 0) list[i] = e; else list.push(e);
      }
    },
    async insertPlans(r) {
      return r.map((p) => {
        const row = { created_by: null, ...p, id: crypto.randomUUID(), generated_at: now() } as PlanRow;
        t<PlanRow>('plans').push(row);
        return { id: row.id };
      });
    },
    async getPlan(id) { return t<PlanRow>('plans').find((p) => p.id === id) ?? null; },
    async insertForecast(row) {
      const id = crypto.randomUUID();
      t('forecasts').push({ created_by: null, ...row, id, created_at: now() });
      return { id };
    },
    async insertDecision(row) {
      const d = { decided_by: null, notes: null, ...row, id: crypto.randomUUID(), decided_at: now(), status: 'planned' } as DecisionRow;
      t<DecisionRow>('decisions').push(d);
      return d;
    },
    async deleteDecision(id) {
      // Mimics ON DELETE CASCADE.
      tables.decisions = t<DecisionRow>('decisions').filter((r) => r.id !== id);
      tables.checklist_items = t<ChecklistRow>('checklist_items').filter((r) => r.decision_id !== id);
      tables.announcements = t<AnnouncementRow>('announcements').filter((r) => r.decision_id !== id);
    },
    async insertChecklist(r) {
      return r.map((c) => {
        const row: ChecklistRow = { done: false, done_by: null, done_at: null, ...c, id: crypto.randomUUID() };
        t<ChecklistRow>('checklist_items').push(row);
        return row;
      });
    },
    async insertAnnouncement(row) {
      const a: AnnouncementRow = { ...row, id: crypto.randomUUID(), edited_text: null, updated_at: now() };
      t<AnnouncementRow>('announcements').push(a);
      return a;
    },
    async upsertBaselineValues(r, by) {
      const list = t<BaselineValueRow & { updated_by?: string }>('baseline_values');
      for (const v of r) {
        const row = { ...v, updated_by: by, updated_at: now() };
        const i = list.findIndex((x) => x.key === v.key);
        if (i >= 0) list[i] = row; else list.push(row);
      }
      return r.length;
    },
    async replaceTable(table, r) { tables[table] = [...r]; return r.length; },
    async startJob(name, method) {
      const list = t<JobRunRow & { job_name: string; finished_at: string | null }>('job_runs');
      const id = list.reduce((m, r) => Math.max(m, r.id), 0) + 1;
      list.push({ id, job_name: name, started_at: now(), finished_at: null, status: 'running', method: method ?? null, items_found: 0, items_changed: 0, error_summary: null });
      return id;
    },
    async finishJob(id, patch) {
      const r = t<JobRunRow & Record<string, unknown>>('job_runs').find((x) => x.id === id);
      if (!r) throw new RepoError('finishJob', `no job run ${id}`);
      Object.assign(r, {
        status: patch.status, finished_at: now(), items_found: patch.itemsFound ?? 0, items_changed: patch.itemsChanged ?? 0, error_summary: patch.errorSummary ?? null,
      });
      if (patch.method !== undefined) r.method = patch.method;
    },
    async latestJob(name) {
      const runs = t<JobRunRow & { job_name: string }>('job_runs').filter((r) => r.job_name === name);
      if (runs.length === 0) return null;
      return toJobRun(runs.reduce((a, b) => (b.started_at > a.started_at || (b.started_at === a.started_at && b.id > a.id) ? b : a)));
    },
    async failStaleJobs(name, olderThanIso) {
      const stale = t<JobRunRow & { job_name: string; finished_at: string | null }>('job_runs')
        .filter((r) => r.job_name === name && r.status === 'running' && Date.parse(r.started_at) < Date.parse(olderThanIso));
      for (const r of stale) Object.assign(r, { status: 'failed', finished_at: now(), error_summary: 'interrupted' });
      return stale.length;
    },
    async replaceTimetable(dates, days, groups, conditioned) {
      const drop = new Set(dates);
      for (const spec of TIMETABLE_TABLES) {
        const next = spec.pick({ days, groups, conditioned }) as Record<string, unknown>[];
        const keep = new Set(next.map((x) => keyOf(x, spec.key)));
        const kept = t<Record<string, unknown>>(spec.table).filter((r) => !(drop.has(String(r.date)) && !keep.has(keyOf(r, spec.key))));
        upsertBy(kept, next, (x) => keyOf(x, spec.key));
        tables[spec.table] = kept;
      }
    },
    async insertMissingRooms(r) {
      const list = t<RoomRow>('rooms');
      for (const x of r) if (!list.some((e) => e.code === x.code)) list.push(x);
      return r.length;
    },
    async upsertPrayer(r) { upsertBy(t<object>('prayer_times'), r, (x) => `${x.date}|${x.zone}`); return r.length; },
    async upsertWeather(r) { upsertBy(t<object>('weather_hourly'), r, (x) => String(Date.parse(x.time))); return r.length; },
    async upsertTraffic(r) { upsertBy(t<object>('traffic_cache'), r, (x) => `${x.date}|${x.hour_index}|${x.direction}|${x.kind}`); return r.length; },
    async upsertRidership(r) { upsertBy(t<object>('lrt_ridership_daily'), r, (x) => `${x.date}|${x.station}`); return r.length; },
    async incrementApiUsage(service, month, n) {
      const list = t<{ service: string; month: string; count: number }>('api_usage');
      let row = list.find((r) => r.service === service && r.month === month);
      if (!row) { row = { service, month, count: 0 }; list.push(row); }
      row.count += n;
      return row.count;
    },
    async listDisruptions(f) {
      return t<DisruptionRow>('disruptions')
        .filter((r) => inWindow(r.start_at, f))
        .filter((r) => f.includeDismissed || r.status === 'active')
        .filter((r) => !f.origins || f.origins.includes(r.origin))
        .filter((r) => !f.kinds || f.kinds.includes(r.kind))
        .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
    },
    async upsertRuleDisruptions(kind, r, window) {
      const list = t<DisruptionRow>('disruptions');
      const keep = new Set(r.map((x) => x.id));
      let inserted = 0, updated = 0;
      for (const x of r) {
        const i = list.findIndex((e) => e.id === x.id);
        if (i < 0) { list.push({ ...x }); inserted++; continue; }
        const next: Record<string, unknown> = { ...x };
        for (const k of RULE_KEEP) next[k] = list[i][k];
        list[i] = next as unknown as DisruptionRow;
        updated++;
      }
      const before = list.length;
      tables.disruptions = list.filter((e) => !(e.origin === 'rule' && e.kind === kind && inWindow(e.start_at, window) && !keep.has(e.id)));
      return { inserted, updated, deleted: before - tables.disruptions.length };
    },
    async upsertScannedDisruption(row, sources) {
      const list = t<DisruptionRow>('disruptions');
      const existing = row.dedupe_key === null ? undefined : list.find((e) => e.dedupe_key === row.dedupe_key);
      let outcome: 'inserted' | 'updated' | 'unchanged';
      let id: string;
      if (!existing) {
        list.push({ ...row });
        outcome = 'inserted';
        id = row.id;
      } else {
        id = existing.id;
        if (scanChanged(existing, row)) {
          Object.assign(existing, Object.fromEntries(SCAN_FIELDS.map((f) => [f, row[f]])), { updated_at: now() });
          outcome = 'updated';
        } else outcome = 'unchanged';
      }
      upsertBy(t<object>('disruption_sources'), sources.map((s) => ({ ...s, disruption_id: id })), (x) => `${x.disruption_id}|${x.url}`);
      return outcome;
    },
    async updateRisk(id, risk) {
      const r = t<DisruptionRow>('disruptions').find((x) => x.id === id);
      if (!r) throw new RepoError('updateRisk', `no disruption ${id}`);
      Object.assign(r, { risk_level: risk.level, risk_reason: risk.reason, risk_peaks: risk.peaks, risk_computed_at: risk.computedAt });
    },
  };
}
