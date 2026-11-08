import type { SupabaseClient } from '@supabase/supabase-js';
import type { RowFilter, RowsClient } from '@bundle/assemble.ts';
import type { TableName } from '@bundle/rows.ts';

interface FilterBuilder extends Record<RowFilter['op'], (column: string, value: unknown) => FilterBuilder> {
  order(column: string): FilterBuilder;
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: unknown }>;
}
const PAGE = 1000;   // PostgREST's default row cap per request

/** Primary-key columns of each table; paging orders by them so a concurrent write can't duplicate or skip a row between pages. */
const PRIMARY_KEY: Record<TableName, string[]> = {
  baseline_values: ['key'], settings: ['id'], rooms: ['code'], cafeteria_outlets: ['id'], energy_profiles: ['block'], waiting_halls: ['id'],
  shuttle_timetable: ['service', 'direction', 'departure_min'], timetable_days: ['date'],
  timetable_groups: ['date', 'block', 'room_type', 'start_min', 'end_min'], timetable_conditioned: ['date', 'block', 'room_type', 'step'],
  prayer_times: ['date', 'zone'], weather_hourly: ['time'], traffic_cache: ['date', 'hour_index', 'direction', 'kind'],
  lrt_ridership_daily: ['date', 'station'], disruptions: ['id'], disruption_sources: ['disruption_id', 'url'], ai_estimates: ['id'], sources: ['id'],
};

/** Reads tables through the Supabase query builder, one RowFilter operator per builder method, paging past the row cap. */
export function supabaseRowsClient(client: SupabaseClient): RowsClient {
  return {
    async select(table, filters = []) {
      const out: unknown[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = client.from(table).select('*') as unknown as FilterBuilder;
        for (const f of filters) q = q[f.op](f.column, f.value);
        for (const column of PRIMARY_KEY[table]) q = q.order(column);
        const { data, error } = await q.range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...(data ?? []));
        if (!data || data.length < PAGE) return out;
      }
    },
  };
}
