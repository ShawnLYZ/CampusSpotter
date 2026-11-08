import { effectiveTimes, mytParts } from '@bundle/assemble.ts';
import type { DisruptionRow, DisruptionSourceRow } from '@bundle/rows.ts';
import type { EarlyWarningItem, PeakView } from '../types.ts';

const DAY_MS = 86_400_000;

/** A disruptions row as read with `select('*, disruption_sources(*)')`; its risk_* columns carry the risk to show. */
export type DisruptionWithSources = DisruptionRow & { disruption_sources: DisruptionSourceRow[] };

/** Pure row to item mapping. `today` is the campus date (YYYY-MM-DD). */
export function toEarlyWarningItem(row: DisruptionWithSources, today: string): EarlyWarningItem {
  const t = effectiveTimes(row);
  const todayStartMs = Date.parse(`${today}T00:00:00+08:00`);
  const overridden = row.override_start_at !== null || row.override_end_at !== null || row.override_attendance !== null;
  return {
    id: row.id, title: row.title, type: row.type, kind: row.kind, venue: row.venue, startAt: t.start_at, endAt: t.end_at,
    expectedAttendance: t.expected_attendance,
    attendanceLabel: row.override_attendance !== null ? 'verified' : row.attendance_label,
    origin: row.origin, status: row.status,
    override: overridden
      ? { startAt: row.override_start_at, endAt: row.override_end_at, expectedAttendance: row.override_attendance, by: row.overridden_by, at: row.overridden_at }
      : null,
    riskLevel: row.risk_level, riskReason: row.risk_reason, riskComputedAt: row.risk_computed_at,
    topPeaks: (row.risk_peaks as PeakView[] | null) ?? [],
    sources: row.disruption_sources.map((s) => ({ url: s.url, title: s.title, publishedAt: s.published_at })),
    notes: row.notes,
    daysRemaining: Math.round((Date.parse(`${mytParts(t.start_at).date}T00:00:00+08:00`) - todayStartMs) / DAY_MS),
    isPast: Date.parse(t.end_at) < todayStartMs,
  };
}
