import { rowGroupsForStation } from '../_shared/parsers.ts';
import type { GroupStats } from '../_shared/parsers.ts';

export interface StationRow { origin: string; destination: string; date: Date | string; ridership: number }

/** The subset of hyparquet / hyparquet-compressors used here, injected so tests can stub it. */
export interface ParquetLib {
  asyncBufferFromUrl: (o: { url: string }) => Promise<unknown>;
  parquetMetadataAsync: (file: never) => Promise<{
    row_groups: { num_rows: bigint | number; columns: { meta_data?: { path_in_schema: string[]; statistics?: { min_value?: unknown; max_value?: unknown } } }[] }[];
  }>;
  parquetReadObjects: (o: { file: never; rowStart: number; rowEnd: number; columns: string[]; compressors: unknown }) => Promise<Record<string, unknown>[]>;
  compressors: unknown;
}

const str = (v: unknown): string => (v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v ?? ''));

/** Reads only the row groups whose origin/destination statistics can contain the station. */
export async function readStationRows(url: string, station: string, lib: ParquetLib): Promise<StationRow[]> {
  const file = (await lib.asyncBufferFromUrl({ url })) as never;
  const meta = await lib.parquetMetadataAsync(file);
  const groups: GroupStats[] = meta.row_groups.map((g) => {
    const stat = (name: string) => {
      const s = g.columns.find((c) => c.meta_data?.path_in_schema.join('.') === name)?.meta_data?.statistics;
      if (s?.min_value == null || s?.max_value == null) throw new Error(`ridership: missing statistics for ${name}`);
      return { min: str(s.min_value), max: str(s.max_value) };
    };
    const o = stat('origin');
    const d = stat('destination');
    return { numRows: Number(g.num_rows), originMin: o.min, originMax: o.max, destinationMin: d.min, destinationMax: d.max };
  });
  const ranges = rowGroupsForStation(groups, station);
  if (ranges.length === 0) throw new Error(`ridership: no row groups for ${station}`);
  const out: StationRow[] = [];
  for (const { rowStart, rowEnd } of ranges) {
    const rows = await lib.parquetReadObjects({ file, rowStart, rowEnd, columns: ['origin', 'destination', 'date', 'ridership'], compressors: lib.compressors });
    for (const r of rows) out.push({ origin: String(r.origin), destination: String(r.destination), date: r.date as Date | string, ridership: Number(r.ridership) });
  }
  return out;
}
