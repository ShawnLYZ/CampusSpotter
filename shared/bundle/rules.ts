import type { DisruptionRow, PrayerRow, WeatherRow } from './rows.ts';
import { addDays, dayOfWeek } from '../engine/grid.ts';
import { mytParts } from './assemble.ts';

const RULE_UPDATED_AT = '2026-11-05T12:00:00+08:00';
const p2 = (n: number): string => String(n).padStart(2, '0');

/** Date + minutes after 00:00 of `date` (may exceed 1440) to an ISO +08:00 timestamp. */
function stamp(date: string, min: number): string {
  const dayShift = Math.floor(min / 1440);
  const m = min - dayShift * 1440;
  return `${addDays(date, dayShift)}T${p2(Math.floor(m / 60))}:${p2(m % 60)}:00+08:00`;
}

function ruleRow(id: string, title: string, type: DisruptionRow['type'], kind: DisruptionRow['kind'], start_at: string, end_at: string): DisruptionRow {
  return {
    id, title, type, kind, venue: null, start_at, end_at,
    expected_attendance: null, attendance_label: null, origin: 'rule',
    override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
    status: 'active', risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null,
    notes: null, dedupe_key: null, created_by: null, updated_at: RULE_UPDATED_AT,
  };
}

export function fridayPrayerRows(prayers: PrayerRow[], fromDate: string, toDate: string): DisruptionRow[] {
  return prayers
    .filter((p) => p.date >= fromDate && p.date <= toDate && dayOfWeek(p.date) === 5)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((p) => ruleRow(`friday-prayer-${p.date}`, 'Weekly Friday prayer', 'weekly_pattern', 'friday_prayer', stamp(p.date, p.dhuhr_min - 45), stamp(p.date, p.dhuhr_min + 105)));
}

export function heavyRainRows(
  weather: WeatherRow[],
  opts: { minProbPct?: number; minMmPerH?: number; fromHour?: number; toHour?: number } = {},
): DisruptionRow[] {
  const { minProbPct = 70, minMmPerH = 5, fromHour = 7, toHour = 22 } = opts;
  const byDate = new Map<string, number[]>();
  for (const w of weather) {
    if (w.precipitation_probability === null || w.precipitation_mm === null) continue;
    if (w.precipitation_probability < minProbPct || w.precipitation_mm < minMmPerH) continue;
    const { date, hour: h } = mytParts(w.time);
    if (h < fromHour || h >= toHour) continue;
    const hours = byDate.get(date) ?? [];
    hours.push(h);
    byDate.set(date, hours);
  }
  return [...byDate.keys()].sort().map((date) => {
    const hours = byDate.get(date)!;
    return ruleRow(`heavy-rain-${date}`, 'Heavy rain forecast', 'weather', 'heavy_rain', stamp(date, Math.min(...hours) * 60), stamp(date, (Math.max(...hours) + 1) * 60));
  });
}
