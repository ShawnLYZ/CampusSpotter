import { mkdirSync, writeFileSync } from 'node:fs';
import { fixtureTables } from '../shared/fixtures/rows/index.ts';
import { toUpsertSql, type SqlColumn, type SqlType } from './lib/sql.ts';

// Column lists and types mirror supabase/migrations/20261105000002_core_tables.sql.
const T: Record<string, SqlType> = { t: 'text', n: 'number', b: 'boolean', j: 'jsonb', z: 'timestamptz', d: 'date' };
const cols = (spec: string): SqlColumn[] =>
  spec.split(' ').map((s) => {
    const [name, t] = s.split(':');
    return { name, type: T[t] };
  });

type Row = Record<string, unknown>;
interface Step { table: string; spec: string; conflict: string[]; pick?: (r: Row) => boolean; map?: (r: Row) => Row }

const SEED_DISRUPTIONS = ['weeknd-2026-11-04', 'weeknd-2026-11-05'];
const inSeed = (r: Row) => SEED_DISRUPTIONS.includes(r.id as string);

const steps: Step[] = [
  { table: 'sources', spec: 'id:t name:t label:t url:t licence:t job_name:t expected_interval_h:n description:t', conflict: ['id'] },
  { table: 'baseline_values', spec: 'key:t value:j unit:t label:t description:t source_id:t updated_at:z', conflict: ['key'] },
  { table: 'settings', spec: 'id:n value:j updated_at:z', conflict: ['id'] },
  { table: 'rooms', spec: 'code:t block:t level:t room_type:t seats:n seats_label:t', conflict: ['code'] },
  { table: 'cafeteria_outlets', spec: 'id:t name:t zone:t counters:n service_rate_per_counter_15min:n opens_min:n closes_min:n staff:n diner_share:n label:t', conflict: ['id'] },
  { table: 'energy_profiles', spec: 'block:t base_load_kw:n occupied_room_kw:n idle_room_kw:n label:t', conflict: ['block'] },
  { table: 'waiting_halls', spec: 'id:t name:t block:t capacity:n load_kw:n label:t', conflict: ['id'] },
  { table: 'shuttle_timetable', spec: 'service:t direction:t departure_min:n loop_to_min:n limited_seats:b label:t source_id:t effective_from:d', conflict: ['service', 'direction', 'departure_min'] },
  {
    table: 'disruptions',
    spec: 'id:t title:t type:t kind:t venue:t start_at:z end_at:z expected_attendance:n attendance_label:t origin:t override_start_at:z override_end_at:z override_attendance:n overridden_by:t overridden_at:z status:t risk_level:t risk_reason:t risk_peaks:j risk_computed_at:z notes:t dedupe_key:t created_by:t updated_at:z',
    conflict: ['id'],
    pick: inSeed,
  },
  {
    table: 'disruption_sources',
    spec: 'disruption_id:t url:t title:t published_at:z fetched_at:z',
    conflict: ['disruption_id', 'url'],
    pick: (r) => SEED_DISRUPTIONS.includes(r.disruption_id as string),
  },
  {
    table: 'traffic_cache',
    spec: 'date:d hour_index:n direction:t kind:t duration_s:n static_duration_s:n fetched_at:z',
    conflict: ['date', 'hour_index', 'direction', 'kind'],
    pick: (r) => r.kind === 'reconstructed',
  },
  {
    table: 'ai_estimates',
    spec: 'context_hash:t disruption_id:t date:d key:t likely:j low:j high:j unit:t reasoning:t confidence:t model:t clamped:b created_at:z',
    conflict: ['context_hash', 'key'],
    pick: (r) => r.disruption_id === 'weeknd-2026-11-04',
    map: (r) => ({ ...r, context_hash: 'reconstruction-2026-11-04' }),
  },
];

const parts = ['begin;'];
for (const s of steps) {
  let rows = fixtureTables[s.table as keyof typeof fixtureTables] as Row[];
  if (s.pick) rows = rows.filter(s.pick);
  if (s.map) rows = rows.map(s.map);
  const sql = toUpsertSql(s.table, rows, cols(s.spec), s.conflict);
  if (sql) parts.push(`-- ${s.table}: ${rows.length} rows`, sql);
}
parts.push('commit;');

mkdirSync('supabase/seed', { recursive: true });
writeFileSync('supabase/seed/phase2-seed.sql', parts.join('\n') + '\n');
console.log('wrote supabase/seed/phase2-seed.sql');
