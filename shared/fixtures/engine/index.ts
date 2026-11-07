import type { InputBundle } from '../../engine/types.ts';
import type { DisruptionRow, EstimateRow, PrayerRow, TableName, TrafficRow, WeatherRow } from '../../bundle/rows.ts';
import { assembleBundle, fetchBundleRows, memoryRowsClient } from '../../bundle/assemble.ts';
import { fridayPrayerRows, heavyRainRows } from '../../bundle/rules.ts';
import { fixtureTables } from '../rows/index.ts';

export interface FixtureBundleOpts {
  reconstructed?: boolean;
  extraDisruptions?: DisruptionRow[];
  extraEstimates?: EstimateRow[];
  weatherRows?: WeatherRow[];            // replaces the date's weather rows
  trafficUntilHourIndex?: number;        // drops Google traffic rows with hour_index >= this
}

export async function fixtureBundle(date: string, opts: FixtureBundleOpts = {}): Promise<InputBundle> {
  const tables: Partial<Record<TableName, unknown[]>> = { ...fixtureTables };   // shallow copy: never mutate fixtureTables
  if (opts.extraDisruptions) tables.disruptions = [...fixtureTables.disruptions, ...opts.extraDisruptions];
  if (opts.extraEstimates) tables.ai_estimates = [...fixtureTables.ai_estimates, ...opts.extraEstimates];
  if (opts.weatherRows) {
    tables.weather_hourly = [
      ...(fixtureTables.weather_hourly as WeatherRow[]).filter((w) => w.time.slice(0, 10) !== date),
      ...opts.weatherRows,
    ];
  }
  if (opts.trafficUntilHourIndex !== undefined) {
    const cut = opts.trafficUntilHourIndex;
    tables.traffic_cache = (fixtureTables.traffic_cache as TrafficRow[])
      .filter((t) => !(t.date === date && t.kind === 'google' && t.hour_index >= cut));
  }
  const rows = await fetchBundleRows(memoryRowsClient(tables), date);
  return assembleBundle(rows, { reconstructed: opts.reconstructed });
}

export const normalWednesday = (): Promise<InputBundle> => fixtureBundle('2026-11-18');
export const concert4Nov = (): Promise<InputBundle> => fixtureBundle('2026-11-04', { reconstructed: true });
export const friday6Nov = (): Promise<InputBundle> => fixtureBundle('2026-11-06');
export const btsWeekend12Dec = (): Promise<InputBundle> => fixtureBundle('2026-12-12');
export const holiday9Nov = (): Promise<InputBundle> => fixtureBundle('2026-11-09');
export const missingRoadAfter9pm = (): Promise<InputBundle> => fixtureBundle('2026-11-18', { trafficUntilHourIndex: 14 });

const FRIDAY = '2026-11-06';
const STAMP = '2026-11-05T12:00:00+08:00';
const UNIFI_ID = 'test-unifi-2026-11-06';

const rainRows = (): WeatherRow[] => [15, 16, 17, 18].map((h) => ({
  time: `${FRIDAY}T${h}:00:00+08:00`, precipitation_mm: 8, precipitation_probability: 90, fetched_at: STAMP,
}));

const unifiEvent = (): DisruptionRow => ({
  id: UNIFI_ID, title: 'Unifi Arena concert', type: 'stadium_event', kind: 'concert', venue: 'Unifi Arena',
  start_at: `${FRIDAY}T20:00:00+08:00`, end_at: `${FRIDAY}T23:00:00+08:00`,
  expected_attendance: 10000, attendance_label: 'verified', origin: 'scan',
  override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
  status: 'active', risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null,
  notes: null, dedupe_key: null, created_by: null, updated_at: STAMP,
});

function unifiEstimates(): EstimateRow[] {
  const bts = (fixtureTables.ai_estimates as EstimateRow[]).filter((e) => e.disruption_id === 'bts-2026-12-12');
  const stamped = (r: EstimateRow): EstimateRow => ({
    ...r, context_hash: 'fixture', disruption_id: UNIFI_ID, date: FRIDAY, model: 'test', clamped: false, created_at: '2026-11-05T09:00:00+08:00',
  });
  const curve = (key: EstimateRow['key']): EstimateRow => stamped(structuredClone(bts.find((e) => e.key === key)!));
  const flat = (key: EstimateRow['key'], v: number | number[], unit: string): EstimateRow => stamped({
    context_hash: '', disruption_id: '', date: '', key, likely: v, low: v, high: v, unit,
    reasoning: 'Test fixture value.', confidence: 'medium', model: '', clamped: false, created_at: '',
  });
  return [
    flat('eventRoadUplift', [1, 1, 1, 1, 1, 1, 1.1, 1.2, 1.4, 1.6, 2, 2.4, 2.5, 2.2, 1.8, 1.6, 1.4, 1.2, 1.1, 1], 'ratio'),
    curve('eventArrivalCurve'), curve('eventDepartureCurve'),
    flat('eventLrtModeShare', 0.4, 'share'), flat('attendanceDrop', 0.1, 'share'), flat('dinnerStayShare', 0.3, 'share'),
  ];
}

/**
 * Every variant adds the rule-generated Friday-prayer disruption (it is not among the stored fixture rows).
 * '+rain' adds 15:00-18:00 rain (8 mm, 90%) plus its heavy-rain rule row; '+event' adds the Unifi Arena concert and its estimates.
 */
export function fridayVariant(v: 'friday' | 'friday+rain' | 'friday+event' | 'friday+rain+event'): Promise<InputBundle> {
  const extraDisruptions: DisruptionRow[] = fridayPrayerRows(fixtureTables.prayer_times as PrayerRow[], FRIDAY, FRIDAY);
  const opts: FixtureBundleOpts = { extraDisruptions };
  if (v.includes('rain')) {
    opts.weatherRows = rainRows();
    extraDisruptions.push(...heavyRainRows(opts.weatherRows));
  }
  if (v.includes('event')) {
    extraDisruptions.push(unifiEvent());
    opts.extraEstimates = unifiEstimates();
  }
  return fixtureBundle(FRIDAY, opts);
}
