import { mytParts } from '../../../shared/bundle/assemble.ts';
import type { TrafficRow } from '../../../shared/bundle/rows.ts';
import { addDays } from '../../../shared/engine/grid.ts';
import { fail } from '../_shared/http.ts';
import { requireSecretKey, runJob } from '../_shared/jobs.ts';
import { parseRouteDuration, routeDepartureTimes } from '../_shared/parsers.ts';
import type { Repo } from '../_shared/repo.ts';
import { refreshRisks } from '../_shared/risk.ts';

export const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
export const ROUTES_FIELD_MASK = 'routes.duration,routes.staticDuration';
export const MONTHLY_CAP = 4000;
export const CAP_MESSAGE = 'traffic forecast paused (monthly cap)';

export interface SyncTrafficDeps { repo: Repo; fetchFn: typeof fetch; now: () => Date; routesKey: string; secretKeys: readonly string[] }

const APU = { latitude: 3.05607, longitude: 101.70047 };
const LRT = { latitude: 3.05813, longitude: 101.69222 };
const DIRECTIONS = [
  { direction: 'apu_to_lrt', from: APU, to: LRT },
  { direction: 'lrt_to_apu', from: LRT, to: APU },
] as const;
const LOOKAHEAD_DAYS = 30;
const MIN_LEAD_MS = 5 * 60 * 1000;
/** A risky date whose google rows were fetched within this long is not fetched again (unless it is within NEAR_DAYS). */
const FRESH_MS = 3 * 24 * 3600 * 1000;
/** Risky dates up to today + NEAR_DAYS are always refetched: their forecast changes most. */
const NEAR_DAYS = 2;

/**
 * Fetches traffic-aware drive durations for today and upcoming high-risk days, under the monthly request cap. A risky
 * date beyond today + 2 with google rows fetched in the last 3 days is skipped. Rows are saved after each date.
 */
export async function handle(req: Request, deps: SyncTrafficDeps): Promise<Response> {
  if (!requireSecretKey(req, deps.secretKeys)) return fail(401, 'secret key required');
  const { repo, fetchFn, now, routesKey } = deps;
  return runJob(repo, 'sync-traffic', async () => {
    const start = now();
    const today = mytParts(start.toISOString()).date;
    const month = today.slice(0, 7);
    const fetchedAt = start.toISOString();

    const upcoming = await repo.listDisruptions({
      fromIso: `${today}T00:00:00+08:00`,
      toIso: `${addDays(today, LOOKAHEAD_DAYS)}T00:00:00+08:00`,
    });
    const riskyDates = upcoming
      .filter((d) => d.risk_level === 'high' || d.risk_level === 'critical')
      .map((d) => mytParts(d.start_at).date);
    const dates: string[] = [];
    for (const date of [...new Set([today, ...riskyDates])].sort()) {
      if (date !== today && date > addDays(today, NEAR_DAYS)) {
        const cached = (await repo.rows.select('traffic_cache', [
          { column: 'date', op: 'eq', value: date }, { column: 'kind', op: 'eq', value: 'google' },
        ])) as TrafficRow[];
        if (cached.some((r) => start.getTime() - Date.parse(r.fetched_at) < FRESH_MS)) continue;
      }
      dates.push(date);
    }

    const rows: TrafficRow[] = [];
    let unsaved: TrafficRow[] = [];
    let requests = 0;
    /** Writes the rows not yet saved, so a killed worker keeps every completed date. */
    const flush = async () => {
      if (unsaved.length === 0) return;
      await repo.upsertTraffic(unsaved);
      unsaved = [];
    };
    /** Saves what was fetched so far and refreshes risks for the dates that got rows. */
    const save = async () => {
      await flush();
      const got = [...new Set(rows.map((r) => r.date))];
      if (got.length > 0) await refreshRisks(repo, { today, dates: got });
    };

    for (const date of dates) {
      for (const { hourIndex, departureTimeUtc } of routeDepartureTimes(date)) {
        if (Date.parse(departureTimeUtc) <= start.getTime() + MIN_LEAD_MS) continue;
        for (const d of DIRECTIONS) {
          const count = await repo.incrementApiUsage('google_routes', month, 1);
          if (count > MONTHLY_CAP) {
            await save();
            throw new Error(CAP_MESSAGE);
          }
          requests++;
          let row: TrafficRow;
          try {
            const res = await fetchFn(ROUTES_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': routesKey, 'X-Goog-FieldMask': ROUTES_FIELD_MASK },
              body: JSON.stringify({
                origin: { location: { latLng: d.from } },
                destination: { location: { latLng: d.to } },
                travelMode: 'DRIVE',
                routingPreference: 'TRAFFIC_AWARE',
                departureTime: departureTimeUtc,
              }),
            });
            if (!res.ok) throw new Error(`routes: HTTP ${res.status}`);
            let p;
            try {
              p = parseRouteDuration(await res.json());
            } catch {
              throw new Error('schema: routes response could not be parsed');
            }
            row = { date, hour_index: hourIndex, direction: d.direction, kind: 'google', duration_s: p.durationS, static_duration_s: p.staticDurationS, fetched_at: fetchedAt };
          } catch (e) {
            await save();
            throw e instanceof Error && /^(routes|schema):/.test(e.message) ? e : new Error('routes: request failed');
          }
          rows.push(row);
          unsaved.push(row);
        }
      }
      await flush();
    }

    await save();
    return { itemsFound: requests, itemsChanged: rows.length };
  });
}
