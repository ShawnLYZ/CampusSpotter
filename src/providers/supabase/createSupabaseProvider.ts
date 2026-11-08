import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { addDays } from '@engine/index.ts';
import type { InputBundle } from '@engine/index.ts';
import { assembleBundle, effectiveTimes, fetchBundleRows, mytParts, typicalRidership } from '@bundle/assemble.ts';
import type { DisruptionRow, RidershipRow } from '@bundle/rows.ts';
import { itemRisk } from '@plans/itemRisk.ts';
import { debounce } from '../debounce.ts';
import type { DataProvider } from '../DataProvider.ts';
import type { AppUser, ContextRequest, DisruptionFilter, DisruptionInput, EarlyWarningItem, OverridePatch, Role, ScanRun, Today } from '../types.ts';
import { ProviderError, forbiddenWrite, toProviderError } from '../errors.ts';
import { toEarlyWarningItem, type DisruptionWithSources } from './mappers.ts';
import { supabaseRowsClient } from './rowsClient.ts';
import { createDataMethods } from './dataMethods.ts';
import { createEmitter } from './events.ts';
import { createInvoke } from './invoke.ts';

const MYT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function todayMyt(): Today {
  const p = Object.fromEntries(MYT.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, nowMin: Number(p.hour) * 60 + Number(p.minute) };
}

const WITH_SOURCES = '*, disruption_sources(*)';
const REALTIME_DEBOUNCE_MS = 300;
const SCAN_POLL_MS = 3000;
const SCAN_WAIT_MS = 150_000;   // the Edge wall limit, after which a scan is closed as interrupted
const STATION = 'SP17: Bukit Jalil';
const TYPICAL_WINDOW_DAYS = 56;
const CLEAR_RISK = { risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null };

/** One PostgREST filter: an item is in the window by its own times or its override times (the client filter then decides on effective times). */
function windowFilter(from: string, to: string): string {
  const lo = `"${from}T00:00:00+08:00"`;
  const hi = `"${to}T23:59:59+08:00"`;
  return `and(or(end_at.gte.${lo},override_end_at.gte.${lo}),or(start_at.lte.${hi},override_start_at.lte.${hi}))`;
}

function validate(input: DisruptionInput): void {
  if (input.title.trim() === '') throw new ProviderError('invalid', 'A title is required.');
  const start = Date.parse(input.startAt);
  const end = Date.parse(input.endAt);
  if (Number.isNaN(start) || Number.isNaN(end)) throw new ProviderError('invalid', 'Start and end must be valid times.');
  if (end <= start) throw new ProviderError('invalid', 'The end must be after the start.');
}

const scanFromRow = (r: Record<string, unknown>): ScanRun => ({
  id: String(r.id), startedAt: r.started_at as string, finishedAt: (r.finished_at as string | null) ?? null,
  status: r.status as ScanRun['status'], method: (r.method as ScanRun['method']) ?? null,
  itemsFound: r.items_found as number, itemsChanged: r.items_changed as number, errorSummary: (r.error_summary as string | null) ?? null,
});

export function createSupabaseProvider(client: SupabaseClient): DataProvider {
  const localEvents = createEmitter();   // changes made here that Realtime does not echo (the baseline import)
  let channelCount = 0;                  // makes each Realtime channel name unique
  async function loadUser(id: string): Promise<AppUser> {
    const { data, error } = await client.from('profiles').select('display_name, role').eq('id', id).maybeSingle();
    if (error) throw new ProviderError('unavailable', 'Couldn’t load your profile. Try again.');
    if (!data) throw new ProviderError('forbidden', 'This account has no CampusSpotter profile.');
    return { id, displayName: data.display_name as string, role: data.role as Role };
  }

  async function signInWith(email: string, password: string): Promise<AppUser> {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      const badLogin = error?.status === 400 || error?.status === 401;
      throw new ProviderError(badLogin ? 'invalid' : 'unavailable',
        badLogin ? 'Email or password is incorrect.' : 'Couldn’t reach the sign-in service. Try again.');
    }
    try {
      return await loadUser(data.user.id);
    } catch (e) {
      await client.auth.signOut({ scope: 'local' }).catch(() => {}); // don't leave a session behind for a login that failed
      throw e;
    }
  }

  async function currentUser(): Promise<AppUser | null> {
    const { data, error } = await client.auth.getSession();
    if (error) {
      // A dead session (bad or expired refresh token) means signed out; only a network failure is worth retrying.
      if (isAuthRetryableFetchError(error)) throw new ProviderError('unavailable', 'Couldn’t check your sign-in. Try again.');
      return null;
    }
    return data.session ? loadUser(data.session.user.id) : null;
  }

  async function requireUser(): Promise<AppUser> {
    const user = await currentUser();
    if (!user) throw new ProviderError('forbidden', 'Sign in to change disruptions.');
    return user;
  }

  async function findRow(id: string): Promise<DisruptionRow> {
    const { data, error } = await client.from('disruptions').select('*').eq('id', id).maybeSingle();
    if (error) throw toProviderError(error, 'that disruption');
    if (!data) throw new ProviderError('not_found', 'Couldn’t find that disruption.');
    return data as DisruptionRow;
  }

  /** Updates one row; a write that matches nothing was blocked by row-level security. */
  async function writeRow(id: string, patch: Record<string, unknown>): Promise<DisruptionWithSources> {
    const { data, error } = await client.from('disruptions').update(patch).eq('id', id).select(WITH_SOURCES);
    if (error) throw toProviderError(error, 'disruptions');
    if (!data || data.length === 0) throw forbiddenWrite('disruptions');
    return data[0] as DisruptionWithSources;
  }

  /** Computes a missing risk in the browser. A manager's result is saved; a failure to compute or save never fails the caller. */
  async function withRisk(row: DisruptionWithSources, user: AppUser | null): Promise<EarlyWarningItem> {
    let shown = row;
    try {
      const risk = await itemRisk(supabaseRowsClient(client), row);
      const stamp = { risk_level: risk.level, risk_reason: risk.reason, risk_peaks: risk.peaks, risk_computed_at: new Date().toISOString() };
      shown = { ...row, ...stamp };
      if (user?.role === 'manager') {
        // supabase-js reports failures in `error` rather than throwing; the risk still shows and is recomputed on the next read.
        const { error } = await client.from('disruptions').update(stamp).eq('id', row.id);
        if (error) console.warn('Couldn’t save the computed risk', error);
      }
    } catch { /* an item whose risk cannot be computed shows without one */ }
    return toEarlyWarningItem(shown, todayMyt().date);
  }

  async function listDisruptions(f: DisruptionFilter): Promise<EarlyWarningItem[]> {
    let q = client.from('disruptions').select(WITH_SOURCES)
      .or(windowFilter(f.from, f.to)).order('start_at');
    if (!f.includeDismissed) q = q.eq('status', 'active');
    if (f.types) q = q.in('type', f.types);
    const { data, error } = await q;
    if (error) throw toProviderError(error, 'disruptions');
    const today = todayMyt().date;
    const todayStartMs = Date.parse(`${today}T00:00:00+08:00`);
    const rows = (data as DisruptionWithSources[]).filter((row) => {
      const t = effectiveTimes(row);
      const endMs = Date.parse(t.end_at);
      if (Number.isNaN(Date.parse(t.start_at)) || Number.isNaN(endMs)) return false;
      if (mytParts(t.start_at).date > f.to || mytParts(new Date(endMs - 1).toISOString()).date < f.from) return false;
      return f.includePast === true || endMs >= todayStartMs;
    });
    const user = rows.some((r) => r.risk_level === null) ? await currentUser().catch(() => null) : null;
    const items = await Promise.all(rows.map((r) => (r.risk_level === null ? withRisk(r, user) : toEarlyWarningItem(r, today))));
    const wanted = f.risks;   // filtered here, not in SQL: a row without a saved risk only gets one after computing it
    return items.filter((i) => !wanted || (i.riskLevel !== null && wanted.includes(i.riskLevel)))
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  }

  async function latestScan(): Promise<ScanRun | null> {
    const { data, error } = await client.from('job_runs').select('*').eq('job_name', 'event-scan')
      .order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw toProviderError(error, 'scan history');
    return data ? scanFromRow(data) : null;
  }

  async function getInputBundle(ctx: ContextRequest): Promise<InputBundle> {
    try {
      return assembleBundle(await fetchBundleRows(supabaseRowsClient(client), ctx.date), { reconstructed: ctx.reconstructed });
    } catch (e) {
      throw toProviderError(e, 'the input data');
    }
  }

  return {
    info: { dataNote: 'Live campus data from the CampusSpotter database.' },
    async getToday() { return todayMyt(); },
    currentUser,
    signIn: signInWith,
    demoSignIn() {
      const email = import.meta.env.VITE_DEMO_EMAIL as string | undefined;
      const password = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;
      if (!email || !password) return Promise.reject(new ProviderError('unavailable', 'Guest access isn’t configured.'));
      return signInWith(email, password);
    },
    async signOut() {
      // Local scope ends only this browser's session; the default (global) would sign out every device sharing the account.
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw new ProviderError('unavailable', 'Couldn’t sign you out. Check your connection and try again.');
    },
    subscribe(channel, handler) {
      if (channel === 'auth') {
        // A dropped session makes reads fall back to anon and come back empty, so tell the route guard to re-check.
        // Deferred: supabase-js can deadlock when its own methods are called inside the auth callback.
        const { data } = client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') setTimeout(handler, 0); });
        return () => data.subscription.unsubscribe();
      }
      if (channel === 'baseline') return localEvents.on('baseline', handler);
      const debounced = debounce(handler, REALTIME_DEBOUNCE_MS);
      const ch = client.channel(`cs-${channel}-${++channelCount}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: channel }, debounced)
        .subscribe();
      return () => { debounced.cancel(); void client.removeChannel(ch); };
    },

    listDisruptions,
    async getDisruption(id) {
      const { data, error } = await client.from('disruptions').select(WITH_SOURCES).eq('id', id).maybeSingle();
      if (error) throw toProviderError(error, 'that disruption');
      if (!data) return null;
      const row = data as DisruptionWithSources;
      return row.risk_level === null ? withRisk(row, await currentUser().catch(() => null)) : toEarlyWarningItem(row, todayMyt().date);
    },
    async createDisruption(input) {
      validate(input);
      const user = await requireUser();
      const { data, error } = await client.from('disruptions').insert({
        id: `manual-${crypto.randomUUID()}`, title: input.title, type: input.type, kind: input.kind, venue: input.venue,
        start_at: input.startAt, end_at: input.endAt, expected_attendance: input.expectedAttendance,
        attendance_label: input.expectedAttendance === null ? null : 'baseline', notes: input.notes, origin: 'manual', created_by: user.id,
      }).select(WITH_SOURCES).single();
      if (error || !data) throw toProviderError(error, 'disruptions');
      return withRisk(data as DisruptionWithSources, user);
    },
    async updateDisruption(id, input) {
      validate(input);
      const user = await requireUser();
      const row = await findRow(id);
      if (row.origin !== 'manual') throw new ProviderError('invalid', 'Only manual disruptions can be edited.');
      const data = await writeRow(id, {
        title: input.title, type: input.type, kind: input.kind, venue: input.venue, start_at: input.startAt, end_at: input.endAt,
        expected_attendance: input.expectedAttendance, notes: input.notes, ...CLEAR_RISK,
      });
      return withRisk(data, user);
    },
    async deleteDisruption(id) {
      const row = await findRow(id);
      if (row.origin !== 'manual') throw new ProviderError('invalid', 'Only manual disruptions can be deleted.');
      const { data, error } = await client.from('disruptions').delete().eq('id', id).select('id');
      if (error) throw toProviderError(error, 'disruptions');
      if (!data || data.length === 0) throw forbiddenWrite('disruptions');
    },
    async dismissDisruption(id) {
      const row = await findRow(id);
      if (row.origin === 'manual') throw new ProviderError('invalid', 'Manual disruptions are deleted, not dismissed.');
      await writeRow(id, { status: 'dismissed' });
    },
    async overrideDisruption(id, patch: OverridePatch) {
      const user = await requireUser();
      const row = await findRow(id);
      if (row.origin !== 'scan') throw new ProviderError('invalid', 'Only scanned disruptions can be overridden.');
      const candidate = { ...row };
      if (patch.startAt !== undefined) candidate.override_start_at = patch.startAt;
      if (patch.endAt !== undefined) candidate.override_end_at = patch.endAt;
      if (patch.expectedAttendance !== undefined) candidate.override_attendance = patch.expectedAttendance;
      const t = effectiveTimes(candidate);
      if (Number.isNaN(Date.parse(t.start_at)) || Number.isNaN(Date.parse(t.end_at)) || Date.parse(t.end_at) <= Date.parse(t.start_at)) {
        throw new ProviderError('invalid', 'The override needs a valid start before the end.');
      }
      const data = await writeRow(id, {
        override_start_at: candidate.override_start_at, override_end_at: candidate.override_end_at, override_attendance: candidate.override_attendance,
        overridden_by: user.id, overridden_at: new Date().toISOString(), ...CLEAR_RISK,
      });
      return withRisk(data, user);
    },
    async triggerScan() {
      const { error } = await client.functions.invoke('event-scan');
      if (error) {
        const res = (error as { context?: Response }).context;
        const status = res?.status;
        if (status === 403) throw forbiddenWrite('scans');
        // A scan that ran and failed answers 500 with its run id and is recorded as a failed run: report that run.
        const body = status === 500 ? await res!.json().catch(() => null) as { jobRunId?: unknown } | null : null;
        if (body?.jobRunId === undefined) throw new ProviderError('unavailable', 'The event scan couldn’t run. Try again.');
      }
      let run = await latestScan();
      // The function joins a scan that is already running and answers at once; wait for that scan to finish.
      for (let waited = 0; run?.status === 'running' && waited < SCAN_WAIT_MS; waited += SCAN_POLL_MS) {
        await new Promise((resolve) => setTimeout(resolve, SCAN_POLL_MS));
        run = await latestScan();
      }
      if (!run) throw new ProviderError('unavailable', 'The event scan left no record. Try again.');
      return run;
    },
    getLatestScan: latestScan,
    getInputBundle,
    async getStationDay(date) {
      let rows: RidershipRow[];
      try {
        rows = await supabaseRowsClient(client).select('lrt_ridership_daily', [
          { column: 'station', op: 'eq', value: STATION },
          { column: 'date', op: 'gte', value: addDays(date, -TYPICAL_WINDOW_DAYS) }, { column: 'date', op: 'lte', value: date },
        ]) as RidershipRow[];
      } catch (e) {
        throw toProviderError(e, 'station ridership');
      }
      const row = rows.find((r) => r.date === date);
      if (!row) return null;
      const typical = typicalRidership(rows, date);
      return {
        date, boardings: row.boardings, alightings: row.alightings,
        typicalBoardings: typical?.typicalDailyBoardings.value ?? null, typicalAlightings: typical?.typicalDailyAlightings.value ?? null,
      };
    },

    ...createDataMethods(client, createInvoke(client), { getInputBundle, currentUser, emitBaseline: () => localEvents.emit('baseline') }),
  };
}
