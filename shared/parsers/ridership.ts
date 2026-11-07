import type { RidershipRow } from '../bundle/rows.ts';

export const BUKIT_JALIL = 'SP17: Bukit Jalil';
export const ALL_STATIONS = 'A0: All Stations';

export interface OdRow { origin: string; destination: string; date: string | Date; ridership: number }
export interface GroupStats { numRows: number; originMin: string; originMax: string; destinationMin: string; destinationMax: string }

function ymd(d: string | Date): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function stationDailyFromOd(rows: OdRow[], station: string = BUKIT_JALIL): RidershipRow[] {
  const byDate = new Map<string, RidershipRow>();
  const get = (date: string): RidershipRow => {
    let r = byDate.get(date);
    if (!r) { r = { date, station, boardings: 0, alightings: 0 }; byDate.set(date, r); }
    return r;
  };
  for (const row of rows) {
    if (row.origin === station && row.destination === ALL_STATIONS) get(ymd(row.date)).boardings += Number(row.ridership);
    else if (row.origin === ALL_STATIONS && row.destination === station) get(ymd(row.date)).alightings += Number(row.ridership);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function rowGroupsForStation(groups: GroupStats[], station: string = BUKIT_JALIL): { rowStart: number; rowEnd: number }[] {
  const out: { rowStart: number; rowEnd: number }[] = [];
  let start = 0;
  for (const g of groups) {
    const inOrigin = (s: string) => s >= g.originMin && s <= g.originMax;
    if (inOrigin(station) || (inOrigin(ALL_STATIONS) && station >= g.destinationMin && station <= g.destinationMax)) {
      out.push({ rowStart: start, rowEnd: start + g.numRows });
    }
    start += g.numRows;
  }
  return out;
}
