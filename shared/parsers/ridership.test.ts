import { describe, expect, it } from 'vitest';
import { ALL_STATIONS, BUKIT_JALIL, rowGroupsForStation, stationDailyFromOd } from './ridership.ts';
import { fixtureTables } from '../fixtures/rows/index.ts';

describe('stationDailyFromOd', () => {
  it('computes boardings and alightings per date, ignoring other stations', () => {
    const rows = [
      { origin: BUKIT_JALIL, destination: ALL_STATIONS, date: '2026-11-04', ridership: 100 },
      { origin: ALL_STATIONS, destination: BUKIT_JALIL, date: '2026-11-04', ridership: 150 },
      { origin: 'SP1: Other', destination: ALL_STATIONS, date: '2026-11-04', ridership: 999 },
      { origin: BUKIT_JALIL, destination: 'SP2: X', date: '2026-11-04', ridership: 5 },
      { origin: ALL_STATIONS, destination: BUKIT_JALIL, date: new Date(Date.UTC(2026, 10, 3)), ridership: 70 },
      { origin: BUKIT_JALIL, destination: ALL_STATIONS, date: new Date(Date.UTC(2026, 10, 3)), ridership: 60 },
    ];
    expect(stationDailyFromOd(rows)).toEqual([
      { date: '2026-11-03', station: BUKIT_JALIL, boardings: 60, alightings: 70 },
      { date: '2026-11-04', station: BUKIT_JALIL, boardings: 100, alightings: 150 },
    ]);
  });
});

describe('rowGroupsForStation', () => {
  it('selects matching groups with cumulative row starts', () => {
    const g = (numRows: number, a: string, b: string, c: string, d: string) => ({ numRows, originMin: a, originMax: b, destinationMin: c, destinationMax: d });
    const groups = [
      g(10, 'SP2: A', 'SP9: Z', 'SP2: A', 'SP9: Z'),
      g(20, 'SP17: Bukit Jalil', 'SP17: Bukit Jalil', 'A0: All Stations', 'SP9: Z'),
      g(30, 'A0: All Stations', 'A0: All Stations', 'SP10: A', 'SP20: Z'),
    ];
    expect(rowGroupsForStation(groups)).toEqual([{ rowStart: 10, rowEnd: 30 }, { rowStart: 30, rowEnd: 60 }]);
  });
});

describe('committed data', () => {
  it.skipIf(fixtureTables.lrt_ridership_daily.length === 0)('has 2026-11-04 values', () => {
    const r = (fixtureTables.lrt_ridership_daily as { date: string; boardings: number; alightings: number }[]).find((x) => x.date === '2026-11-04');
    expect(r?.boardings).toBe(24238);
    expect(r?.alightings).toBe(33804);
  });
});
