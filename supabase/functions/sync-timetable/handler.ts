import { mytParts } from '../../../shared/bundle/assemble.ts';
import { fail } from '../_shared/http.ts';
import { requireServiceRole, runJob } from '../_shared/jobs.ts';
import { aggregateSessions, assertFeedShape, sessionsFromFeed } from '../_shared/parsers.ts';
import type { Repo } from '../_shared/repo.ts';
import { refreshRisks } from '../_shared/risk.ts';

export const FEED_URL = 'https://s3-ap-southeast-1.amazonaws.com/open-ws/weektimetable';

export interface SyncTimetableDeps { repo: Repo; fetchFn: typeof fetch; now: () => Date }

/** Pulls the public timetable feed and stores counts-only session groups. Personal fields and cohort codes are never stored or logged. */
export async function handle(req: Request, deps: SyncTimetableDeps): Promise<Response> {
  if (!requireServiceRole(req)) return fail(401, 'service role required');
  const { repo, fetchFn, now } = deps;
  return runJob(repo, 'sync-timetable', async () => {
    const res = await fetchFn(FEED_URL);
    if (!res.ok) throw new Error(`feed: HTTP ${res.status}`);
    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      throw new Error('schema: feed is not valid JSON');
    }
    const sessions = sessionsFromFeed(assertFeedShape(raw));
    const syncedAt = now().toISOString();
    const agg = aggregateSessions(sessions, syncedAt);
    const dates = [...new Set(sessions.map((s) => s.date))].sort();
    await repo.replaceTimetable(dates, agg.days, agg.groups, agg.conditioned);
    await repo.insertMissingRooms(agg.rooms);
    await refreshRisks(repo, { today: mytParts(syncedAt).date, dates });
    return { itemsFound: sessions.length, itemsChanged: dates.length };
  });
}
