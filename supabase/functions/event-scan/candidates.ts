import type { DisruptionRow, DisruptionSourceRow } from '../../../shared/bundle/rows.ts';
import { addDays } from '../../../shared/engine/grid.ts';
import { canonicalVenue, titleSimilarity, withinKm } from '../_shared/parsers.ts';

/** One event as Gemini extracts it (SCHEMAS.extract). */
export interface ExtractedEvent {
  title: string; venue: string; venueLat?: number; venueLng?: number; startDate: string; startTime?: string; endDate?: string; endTime?: string;
  expectedAttendance?: number | null; attendanceStated: boolean; isApuCalendar: boolean; calendarKind?: 'intake' | 'holiday' | 'break' | 'other';
  sourceUrls: string[]; confidence: 'low' | 'medium' | 'high';
}

/** An accepted event on one date. venueKey is the dedupe venue part; venueName the stored venue. */
export interface Candidate { event: ExtractedEvent; date: string; venueKey: string; venueName: string }
export interface Cluster { key: string; date: string; candidates: Candidate[] }

export const WINDOW_DAYS = 120;
const MAX_DAYS_PER_EVENT = 14;
const RADIUS_KM = 3;
const MERGE_SIMILARITY = 0.5;

/** Lower-case alphanumerics joined by hyphens, at most 40 characters ('event' when nothing is left). */
export function slug(title: string): string {
  const s = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return s || 'event';
}

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

/** "H:MM" or "HH:MM" as "HH:MM", or null. */
function hhmm(s: unknown): string | null {
  const m = typeof s === 'string' ? /^(\d{1,2}):(\d{2})$/.exec(s.trim()) : null;
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** The dedupe venue part and stored venue of an event, or null when it is not near Bukit Jalil. */
function venueOf(e: ExtractedEvent): { venueKey: string; venueName: string } | null {
  const venue = typeof e.venue === 'string' ? e.venue : '';
  const canonical = canonicalVenue(venue);
  if (canonical) return { venueKey: canonical, venueName: canonical };
  if (e.isApuCalendar === true) return { venueKey: 'APU', venueName: 'APU' };
  const { venueLat: lat, venueLng: lng } = e;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && withinKm(lat, lng, RADIUS_KM) && venue.trim()) {
    return { venueKey: venue.trim(), venueName: venue.trim() };
  }
  return null;
}

/**
 * Validates events (start date at most today+120 and either from today on or, for an event already in progress, an end
 * date from today on; venue near Bukit Jalil or APU) and expands each into one candidate per date, starting no earlier than today.
 */
export function expandEvents(events: ExtractedEvent[], today: string): { candidates: Candidate[]; rejected: number } {
  const last = addDays(today, WINDOW_DAYS);
  const candidates: Candidate[] = [];
  let rejected = 0;
  for (const e of events) {
    const v = e && typeof e === 'object' ? venueOf(e) : null;
    const inProgress = isDate(e.startDate) && e.startDate < today && isDate(e.endDate) && e.endDate >= today;
    if (!v || !isDate(e.startDate) || (e.startDate < today && !inProgress) || e.startDate > last || typeof e.title !== 'string' || !e.title.trim()) {
      rejected++;
      continue;
    }
    const first = e.startDate < today ? today : e.startDate;
    const end = isDate(e.endDate) && e.endDate > e.startDate ? (e.endDate < last ? e.endDate : last) : e.startDate;
    for (let d = first, n = 0; d <= end && n < MAX_DAYS_PER_EVENT; d = addDays(d, 1), n++) {
      candidates.push({ event: e, date: d, ...v });
    }
  }
  return { candidates, rejected };
}

/**
 * Groups candidates by base key `${venueKey}|${date}`: a candidate joins the first cluster of its base whose first
 * title is at least 0.5 similar (or has the same slug), otherwise it starts a new cluster. Then keys are assigned:
 * - When `existing` has a stored row under the bare base key and the base has a single cluster, that cluster takes
 *   the bare key whatever its title (one event per venue per date; live titles vary).
 * - With two or more clusters, the bare key goes to the cluster most similar (>= 0.5) to the stored row's title;
 *   if none qualifies, every cluster gets `|${slug}` and the stored row is left alone.
 * - Without a stored row, the first-seen cluster takes the bare key.
 * Every other cluster is keyed `${base}|${slug(first title)}`. `existing` maps stored dedupe_key -> title.
 */
export function mergeCandidates(candidates: Candidate[], existing: ReadonlyMap<string, string> = new Map()): Cluster[] {
  const clusters: Cluster[] = [];
  const byBase = new Map<string, Cluster[]>();
  for (const c of candidates) {
    const base = `${c.venueKey}|${c.date}`;
    const group = byBase.get(base) ?? [];
    byBase.set(base, group);
    const first = (g: Cluster) => g.candidates[0].event.title;
    const hit = group.find((g) => titleSimilarity(first(g), c.event.title) >= MERGE_SIMILARITY || slug(first(g)) === slug(c.event.title));
    if (hit) {
      hit.candidates.push(c);
      continue;
    }
    const cluster: Cluster = { key: base, date: c.date, candidates: [c] };
    group.push(cluster);
    clusters.push(cluster);
  }

  for (const [base, group] of byBase) {
    const stored = existing.get(base);
    let bare: Cluster | undefined;
    // No stored row: first seen. One cluster: it is that date's event at that venue, whatever its live title.
    if (stored === undefined || group.length === 1) bare = group[0];
    else {
      let best = MERGE_SIMILARITY;
      for (const g of group) {
        const s = Math.max(...g.candidates.map((c) => titleSimilarity(stored, c.event.title)));
        if (s >= best && (!bare || s > best)) {
          bare = g;
          best = s;
        }
      }
    }
    for (const g of group) g.key = g === bare ? base : `${base}|${slug(g.candidates[0].event.title)}`;
  }
  return clusters;
}

const RANK = { low: 0, medium: 1, high: 2 } as const;

/** The disruption row and its sources for a merged cluster. Times are MYT (+08:00); an end before the start rolls to the next day. */
export function clusterToRow(
  cluster: Cluster,
  opts: { nowIso: string; publishedAt: Map<string, string | null> },
): { row: DisruptionRow; sources: DisruptionSourceRow[] } {
  const { candidates, date } = cluster;
  const rank = (c: Candidate) => RANK[c.event.confidence] ?? 0;
  const best = candidates.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  const timed = [...candidates].sort((a, b) => rank(b) - rank(a)).find((c) => hhmm(c.event.startTime)) ?? best;
  const calendar = best.event.isApuCalendar === true;

  const start = calendar ? '00:00' : hhmm(timed.event.startTime) ?? '19:30';
  const end = calendar ? '23:59' : hhmm(timed.event.endTime) ?? '23:00';
  const endDate = end < start ? addDays(date, 1) : date;

  const counts = candidates.map((c) => c.event.expectedAttendance).filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  const attendance = counts.length > 0 ? Math.max(...counts) : null;
  const label = attendance === null ? null : candidates.some((c) => c.event.attendanceStated === true) ? 'verified' : 'ai';

  const title = best.event.title.trim();
  const id = `${slug(title)}-${date}`;
  const row: DisruptionRow = {
    id, title,
    type: calendar ? 'apu_calendar' : 'stadium_event',
    kind: calendar ? best.event.calendarKind ?? 'other' : 'concert',
    venue: best.venueName,
    start_at: `${date}T${start}:00+08:00`,
    end_at: `${endDate}T${end}:00+08:00`,
    expected_attendance: attendance,
    attendance_label: label,
    origin: 'scan',
    override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
    status: 'active',
    risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null,
    notes: null,
    dedupe_key: cluster.key,
    created_by: null,
    updated_at: opts.nowIso,
  };

  const sources: DisruptionSourceRow[] = [];
  for (const c of candidates) {
    for (const url of Array.isArray(c.event.sourceUrls) ? c.event.sourceUrls : []) {
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url) || sources.some((s) => s.url === url)) continue;
      sources.push({ disruption_id: id, url, title: c.event.title, published_at: opts.publishedAt.get(url) ?? null, fetched_at: opts.nowIso });
    }
  }
  return { row, sources };
}
