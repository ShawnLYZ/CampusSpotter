import { mytParts } from '../../../shared/bundle/assemble.ts';
import { heavyRainRows } from '../../../shared/bundle/rules.ts';
import { addDays } from '../../../shared/engine/grid.ts';
import { fail } from '../_shared/http.ts';
import { requireSecretKey, runJob } from '../_shared/jobs.ts';
import { parseOpenMeteoHourly } from '../_shared/parsers.ts';
import type { Repo } from '../_shared/repo.ts';
import { refreshRisks, ruleRefreshDates } from '../_shared/risk.ts';

export const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=3.05607&longitude=101.70047&hourly=precipitation,precipitation_probability&timezone=Asia%2FKuala_Lumpur&forecast_days=16&past_days=1';

export interface SyncWeatherDeps { repo: Repo; fetchFn: typeof fetch; now: () => Date; secretKeys: readonly string[] }

const RAIN_DAYS = 16;

/** Refreshes the hourly forecast and regenerates the rule-based heavy-rain items from it. */
export async function handle(req: Request, deps: SyncWeatherDeps): Promise<Response> {
  if (!requireSecretKey(req, deps.secretKeys)) return fail(401, 'secret key required');
  const { repo, fetchFn, now } = deps;
  return runJob(repo, 'sync-weather', async () => {
    const res = await fetchFn(WEATHER_URL);
    if (!res.ok) throw new Error(`open-meteo: HTTP ${res.status}`);
    const fetchedAt = now();
    let hours;
    try {
      hours = parseOpenMeteoHourly(await res.json(), fetchedAt.toISOString());
    } catch {
      throw new Error('schema: open-meteo response could not be parsed');
    }
    const today = mytParts(fetchedAt.toISOString()).date;
    // All of today's hours (from 00:00 MYT), so today's heavy-rain item survives the later runs of the day.
    const dayStart = Date.parse(`${today}T00:00:00+08:00`);
    const upcoming = hours.filter((h) => Date.parse(h.time) >= dayStart);
    if (upcoming.length === 0) throw new Error('schema: open-meteo returned no hourly data from today on');
    const rows = heavyRainRows(upcoming);
    const window = { fromIso: `${today}T00:00:00+08:00`, toIso: `${addDays(today, RAIN_DAYS)}T00:00:00+08:00` };
    const before = await repo.listDisruptions({ ...window, includeDismissed: true, origins: ['rule'], kinds: ['heavy_rain'] });

    await repo.upsertWeather(hours);
    const counts = await repo.upsertRuleDisruptions('heavy_rain', rows, window);

    const dates = ruleRefreshDates(before, rows);
    if (dates.length > 0) await refreshRisks(repo, { today, dates });

    return { itemsFound: hours.length, itemsChanged: counts.inserted + counts.updated + counts.deleted };
  });
}
