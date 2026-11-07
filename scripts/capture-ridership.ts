import { writeFileSync } from 'node:fs';
import { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { rowGroupsForStation, stationDailyFromOd } from '../shared/parsers/ridership.ts';
import type { GroupStats, OdRow } from '../shared/parsers/ridership.ts';

const url = 'https://storage.data.gov.my/transportation/rail/rapidrail_2026_daily.parquet';
const file = await asyncBufferFromUrl({ url });
const meta = await parquetMetadataAsync(file);

const str = (v: unknown): string => (v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v ?? ''));
const groups: GroupStats[] = meta.row_groups.map((g) => {
  const stat = (name: string) => {
    const col = g.columns.find((c) => c.meta_data?.path_in_schema.join('.') === name);
    const s = col?.meta_data?.statistics;
    if (s?.min_value == null || s?.max_value == null) throw new Error(`missing statistics for ${name}`);
    return { min: str(s.min_value), max: str(s.max_value) };
  };
  const o = stat('origin');
  const d = stat('destination');
  return { numRows: Number(g.num_rows), originMin: o.min, originMax: o.max, destinationMin: d.min, destinationMax: d.max };
});

const ranges = rowGroupsForStation(groups);
const od: OdRow[] = [];
for (const { rowStart, rowEnd } of ranges) {
  const rows = await parquetReadObjects({ file, rowStart, rowEnd, columns: ['origin', 'destination', 'date', 'ridership'], compressors });
  for (const r of rows) od.push({ origin: r.origin, destination: r.destination, date: r.date, ridership: Number(r.ridership) });
}
const out = stationDailyFromOd(od);
if (out.length < 200) throw new Error(`only ${out.length} dates produced (expected >= 200)`);
writeFileSync('shared/fixtures/rows/lrt_ridership_daily.json', JSON.stringify(out));
const nov4 = out.find((r) => r.date === '2026-11-04');
console.log(`ridership: ${ranges.length}/${groups.length} groups selected, ${od.length} OD rows read, ${out.length} dates, ${out[0].date}..${out.at(-1)!.date}; 2026-11-04 ${JSON.stringify(nov4)}`);
