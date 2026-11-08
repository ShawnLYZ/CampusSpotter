import { assert, assertEquals } from 'jsr:@std/assert@1';
import { handle } from './handler.ts';
import { rowsToCsv } from '../../../shared/bundle/csv.ts';
import { authedRequest, DEMO_TOKEN, seededRepo } from '../_shared/testkit.ts';

const mk = () => { const repo = seededRepo(); return { repo, deps: { repo, now: () => new Date() } }; };
const energyCsv = (kw = 99) => rowsToCsv('energy_profiles',
  ['A', 'B', 'C', 'D', 'E', 'S', 'L', 'U'].map((block) => ({ block, base_load_kw: kw, occupied_room_kw: 5, idle_room_kw: 1 })));

Deno.test('a demo caller gets 403 and nothing changes', async () => {
  const { repo, deps } = mk();
  const before = structuredClone(repo.tables.energy_profiles);
  const res = await handle(authedRequest({ table: 'energy_profiles', csv: energyCsv(), markVerified: false }, DEMO_TOKEN), deps);
  assertEquals(res.status, 403);
  assertEquals(repo.tables.energy_profiles, before);
});

Deno.test('a bad rooms CSV returns row errors and applies nothing', async () => {
  const { repo, deps } = mk();
  const before = structuredClone(repo.tables.rooms);
  const csv = 'code,block,level,room_type,seats\nX1,Z,1,classroom,40\nX2,A,1,classroom,0\n';
  const res = await handle(authedRequest({ table: 'rooms', csv, markVerified: true }), deps);
  assertEquals(res.status, 200);
  const out = await res.json();
  assertEquals(out.ok, false);
  assertEquals(out.applied, false);
  assert(out.errors.length >= 2);
  assertEquals(repo.tables.rooms, before);
});

Deno.test('a valid CSV with markVerified replaces the table with verified labels', async () => {
  const { repo, deps } = mk();
  const res = await handle(authedRequest({ table: 'energy_profiles', csv: energyCsv(), markVerified: true }), deps);
  assertEquals(await res.json(), { ok: true, applied: true, rowCount: 8, errors: [] });
  const rows = repo.tables.energy_profiles as { base_load_kw: number; label: string }[];
  assertEquals(rows.length, 8);
  assert(rows.every((r) => r.base_load_kw === 99 && r.label === 'verified'));
});

Deno.test('without markVerified rooms get the baseline seats_label', async () => {
  const { repo, deps } = mk();
  const csv = 'code,block,level,room_type,seats\nX1,A,1,classroom,40\n';
  const out = await (await handle(authedRequest({ table: 'rooms', csv, markVerified: false }), deps)).json();
  assertEquals(out.applied, true);
  assertEquals(repo.tables.rooms, [{ code: 'X1', block: 'A', level: '1', room_type: 'classroom', seats: 40, seats_label: 'baseline' }]);
});

Deno.test('baseline_values upsert keeps source_id, stamps updated_by and rejects unknown keys', async () => {
  const { repo, deps } = mk();
  const csv = 'key,value,unit,description\npopulation,13000,students,Updated\n';
  const out = await (await handle(authedRequest({ table: 'baseline_values', csv, markVerified: true }), deps)).json();
  assertEquals(out.applied, true);
  const row = (repo.tables.baseline_values as Record<string, unknown>[]).find((r) => r.key === 'population')!;
  assertEquals([row.value, row.label, row.updated_by], [13000, 'verified', '00000000-0000-0000-0000-000000000001']);
  assert(row.source_id);
  const bad = await (await handle(authedRequest({ table: 'baseline_values', csv: 'key,value,unit,description\nnope,1,x,y\n', markVerified: false }), deps)).json();
  assertEquals(bad.ok, false);
});

Deno.test('csv over 1 MB is rejected with 400', async () => {
  const { deps } = mk();
  const res = await handle(authedRequest({ table: 'rooms', csv: 'x'.repeat(1_000_001), markVerified: false }), deps);
  assertEquals(res.status, 400);
});

Deno.test('a header-only CSV is rejected and the table is untouched', async () => {
  const { repo, deps } = mk();
  const before = structuredClone(repo.tables.rooms);
  const csv = 'code,block,level,room_type,seats\n';
  const res = await handle(authedRequest({ table: 'rooms', csv, markVerified: true }), deps);
  assertEquals(res.status, 200);
  const out = await res.json();
  assertEquals(out.ok, false);
  assertEquals(out.applied, false);
  assertEquals(out.rowCount, 0);
  assertEquals(out.errors, [{ row: 1, column: null, message: 'The file has no data rows' }]);
  assertEquals(repo.tables.rooms, before);
});
