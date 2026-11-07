import { describe, it, expect } from 'vitest';
import { memoryRowsClient, fetchBundleRows, assembleBundle, pickTimetableDate, typicalRidership, dayTypeFor, overlapsDate } from './assemble.ts';
import { fixtureTables } from '../fixtures/rows/index.ts';
import type { DisruptionRow, TimetableDayRow, RidershipRow, BaselineValueRow, WeatherRow, SettingsRow } from './rows.ts';
import type { TableName } from './rows.ts';

const disruptions = fixtureTables.disruptions as DisruptionRow[];
const days = fixtureTables.timetable_days as TimetableDayRow[];
const client = memoryRowsClient(fixtureTables);
const bundle = async (date: string, reconstructed = false) => assembleBundle(await fetchBundleRows(client, date), { reconstructed });

describe('dayTypeFor', () => {
  it('classifies days', () => {
    expect(dayTypeFor('2026-11-09', disruptions)).toBe('no_class');
    expect(dayTypeFor('2026-11-06', disruptions)).toBe('friday');
    expect(dayTypeFor('2026-12-12', disruptions)).toBe('weekend');
    expect(dayTypeFor('2026-12-22', disruptions)).toBe('no_class');
  });
});

describe('pickTimetableDate', () => {
  it('falls back to the same weekday of the latest captured week', () => {
    expect(pickTimetableDate('2026-12-09', days)).toEqual({ date: '2026-11-18', label: 'baseline' });
    expect(pickTimetableDate('2026-11-18', days)).toEqual({ date: '2026-11-18', label: 'verified' });
  });
});

describe('assembleBundle', () => {
  it('uses the typical road pattern when a date has no traffic rows', async () => {
    const b = await bundle('2026-11-25');
    const typical = b.baseline.typicalRoadRatio.value;
    expect(b.road.kind).toBe('typical');
    expect(b.road.ratio[0]?.label).toBe('baseline');
    expect(b.road.ratio.map((r) => r?.value)).toEqual(typical);
  });
  it('uses google rows and reconstructed rows', async () => {
    expect((await bundle('2026-11-18')).road.kind).toBe('google');
    expect((await bundle('2026-11-04', true)).road.kind).toBe('reconstructed');
  });
  it('places after-midnight weather in indices 17-19', async () => {
    const b = await bundle('2026-11-04');
    expect(b.weather?.precipitationMm).toHaveLength(20);
    const rows = fixtureTables.weather_hourly as { time: string; precipitation_mm: number | null }[];
    const row = rows.find((r) => r.time === '2026-11-05T01:00:00+08:00')!;
    expect(b.weather?.precipitationMm[18]?.value ?? null).toBe(row.precipitation_mm);
  });
  it('computes typical ridership', async () => {
    const rows = fixtureTables.lrt_ridership_daily as RidershipRow[];
    const r = typicalRidership(rows, '2026-11-05');
    expect(r).not.toBeNull();
    expect(r!.typicalDailyBoardings.value).toBeGreaterThanOrEqual(2000);
    expect(r!.typicalDailyBoardings.value).toBeLessThanOrEqual(8000);
    expect(typicalRidership(rows.slice(0, 2), '2026-11-05')).toBeNull();
  });
  it('lets a manual override beat the scan attendance', async () => {
    const tables = { ...fixtureTables, disruptions: disruptions.map((d) => d.id === 'weeknd-2026-11-04' ? { ...d, override_attendance: 70000 } : d) };
    const b = assembleBundle(await fetchBundleRows(memoryRowsClient(tables), '2026-11-04'));
    const ref = b.context.disruptions.find((d) => d.id === 'weeknd-2026-11-04')!;
    expect(ref.expectedAttendance).toMatchObject({ value: 70000, label: 'verified' });
  });
  it('throws on a missing baseline key', async () => {
    const tables: Record<TableName, unknown[]> = { ...fixtureTables, baseline_values: (fixtureTables.baseline_values as BaselineValueRow[]).filter((r) => r.key !== 'fleet_size') };
    await expect(fetchBundleRows(memoryRowsClient(tables), '2026-11-18').then((r) => assembleBundle(r))).rejects.toThrow('missing baseline key: fleet_size');
  });
  it('picks shuttle service by day', async () => {
    expect((await bundle('2026-12-12')).shuttle.service).toBe('none');
    expect((await bundle('2026-12-22')).shuttle.service).toBe('reduced');
    expect((await bundle('2026-11-18')).shuttle.service).toBe('normal');
  });
  it('builds timetable, conditioned arrays and no_class days', async () => {
    const b = await bundle('2026-11-18');
    expect(b.timetable?.date).toBe('2026-11-18');
    expect(b.timetable?.conditioned.A).toHaveLength(76);
    const h = await bundle('2026-11-09');
    expect(h.timetable?.groups).toEqual([]);
    expect(h.timetable?.date).toBe('2026-11-09');
  });
});

const toUtc = (iso: string): string => new Date(Date.parse(iso)).toISOString().replace('.000Z', '+00:00');

describe('offset-agnostic timestamps', () => {
  it('overlapsDate answers the same for +00:00 and +08:00 expressions', () => {
    const cases: [string, string, string][] = [
      ['2026-11-04T18:00:00+08:00', '2026-11-05T00:30:00+08:00', '2026-11-05'],
      ['2026-11-04T18:00:00+08:00', '2026-11-05T00:30:00+08:00', '2026-11-04'],
      ['2026-11-04T18:00:00+08:00', '2026-11-05T00:30:00+08:00', '2026-11-06'],
      ['2026-11-03T20:00:00+08:00', '2026-11-04T00:00:00+08:00', '2026-11-04'],
    ];
    for (const [start_at, end_at, date] of cases) {
      expect(overlapsDate({ start_at: toUtc(start_at), end_at: toUtc(end_at) }, date)).toBe(overlapsDate({ start_at, end_at }, date));
    }
    expect(toUtc('2026-11-05T00:30:00+08:00')).toBe('2026-11-04T16:30:00+00:00');
    expect(overlapsDate({ start_at: '2026-11-04T10:00:00+00:00', end_at: '2026-11-04T16:30:00+00:00' }, '2026-11-05')).toBe(true);
    expect(overlapsDate({ start_at: '2026-11-04T10:00:00+00:00', end_at: '2026-11-04T16:00:00+00:00' }, '2026-11-05')).toBe(false);
  });
  it('places UTC-expressed weather rows at the same indices as +08:00 rows', async () => {
    const rows = fixtureTables.weather_hourly as WeatherRow[];
    const utcTables = { ...fixtureTables, weather_hourly: rows.map((r) => ({ ...r, time: toUtc(r.time) })) };
    const a = assembleBundle(await fetchBundleRows(memoryRowsClient(fixtureTables), '2026-11-04'));
    const rowsUtc = (utcTables.weather_hourly as WeatherRow[]);
    const b = assembleBundle({ ...(await fetchBundleRows(memoryRowsClient(fixtureTables), '2026-11-04')), weather: rowsUtc });
    expect(a.weather).not.toBeNull();
    expect(b.weather).toEqual(a.weather);
    const one = assembleBundle({ ...(await fetchBundleRows(memoryRowsClient(fixtureTables), '2026-11-04')),
      weather: [{ time: '2026-11-04T12:00:00+00:00', precipitation_mm: 3, precipitation_probability: 50, fetched_at: 'x' }] });
    expect(one.weather!.precipitationMm[13]).toMatchObject({ value: 3 });
  });
  it('throws a clear error when the settings row is missing', async () => {
    const client2 = memoryRowsClient({ ...fixtureTables, settings: [] as SettingsRow[] });
    await expect(fetchBundleRows(client2, '2026-11-04')).rejects.toThrow('missing settings row');
  });
  it('skips the ai_estimates query when there are no disruptions', async () => {
    const seen: string[] = [];
    const spy = { select: async (t: TableName, f?: Parameters<typeof client.select>[1]) => { seen.push(t); return client.select(t, f); } };
    const none = { select: async (t: TableName, f?: Parameters<typeof client.select>[1]) => (t === 'disruptions' ? [] : spy.select(t, f)) };
    const r = await fetchBundleRows(none, '2026-11-04');
    expect(r.estimates).toEqual([]);
    expect(seen).not.toContain('ai_estimates');
  });
});
