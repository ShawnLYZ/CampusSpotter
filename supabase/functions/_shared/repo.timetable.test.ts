import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { createSupabaseRepo } from './repo.ts';

type R = Record<string, unknown>;
const MAX_ROWS = 1000;

/** A minimal fake of the chain replaceTimetable uses; select honours range() and caps at max_rows like PostgREST. */
function fakeAdmin(initial: Record<string, R[]>, opts: { failUpsert?: boolean } = {}) {
  const tables: Record<string, R[]> = {};
  for (const [k, v] of Object.entries(initial)) tables[k] = [...v];
  const log = { upserts: 0, selects: 0, deletes: 0, ranges: [] as [string, number, number][], maxInFlight: 0 };
  let inFlight = 0;
  const from = (table: string) => {
    tables[table] ??= [];
    const q = {
      mode: '' as 'upsert' | 'select' | 'delete',
      payload: [] as R[], eqs: {} as R, matches: {} as R, orderBy: [] as string[], span: null as [number, number] | null,
      upsert(rows: R[], o: { onConflict: string }) {
        q.mode = 'upsert'; q.payload = rows; (q as R).conflict = o.onConflict.split(','); return q;
      },
      select() { q.mode = 'select'; return q; },
      delete() { q.mode = 'delete'; return q; },
      eq(c: string, v: unknown) { q.eqs[c] = v; return q; },
      order(c: string) { q.orderBy.push(c); return q; },
      range(a: number, b: number) { q.span = [a, b]; return q; },
      match(o: R) { q.matches = o; return q; },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return run().then(resolve, reject);
      },
    };
    const run = async (): Promise<{ data: unknown; error: { message: string } | null }> => {
      inFlight++;
      log.maxInFlight = Math.max(log.maxInFlight, inFlight);
      await Promise.resolve();
      try {
        if (q.mode === 'upsert') {
          log.upserts++;
          if (opts.failUpsert) return { data: null, error: { message: 'upsert failed' } };
          const key = (q as R).conflict as string[];
          for (const row of q.payload) {
            const i = tables[table].findIndex((e) => key.every((k) => e[k] === row[k]));
            if (i >= 0) tables[table][i] = row; else tables[table].push(row);
          }
          return { data: null, error: null };
        }
        if (q.mode === 'select') {
          log.selects++;
          let rows = tables[table].filter((r) => Object.entries(q.eqs).every(([c, v]) => r[c] === v));
          rows = [...rows].sort((a, b) => {
            for (const c of q.orderBy) { if (a[c] !== b[c]) return (a[c] as number) < (b[c] as number) ? -1 : 1; }
            return 0;
          });
          const [from, to] = q.span ?? [0, MAX_ROWS - 1];
          log.ranges.push([table, from, to]);
          return { data: rows.slice(from, Math.min(to, from + MAX_ROWS - 1) + 1), error: null };
        }
        log.deletes++;
        tables[table] = tables[table].filter((r) => !Object.entries(q.matches).every(([c, v]) => r[c] === v));
        return { data: null, error: null };
      } finally {
        inFlight--;
      }
    };
    return q;
  };
  return { admin: { from } as unknown as SupabaseClient, tables, log };
}

const group = (date: string, start_min: number, count = 1) =>
  ({ date, block: 'A', room_type: 'classroom', start_min, end_min: start_min + 1, count, first_of_day_share: 0, last_of_day_share: 0 });

Deno.test('supabase replaceTimetable prunes stale rows across pages and leaves other dates alone', async () => {
  const existing = [...Array.from({ length: 2500 }, (_, i) => group('2026-11-10', i)), group('2026-11-11', 1)];
  const { admin, tables, log } = fakeAdmin({ timetable_groups: existing });
  const keep = [group('2026-11-10', 5, 9), group('2026-11-10', 1800), group('2026-11-10', 2499)];
  await createSupabaseRepo(admin).replaceTimetable(['2026-11-10'], [], keep as never, []);
  const rows = tables.timetable_groups;
  assertEquals(rows.filter((r) => r.date === '2026-11-10').map((r) => r.start_min).sort((a, b) => (a as number) - (b as number)), [5, 1800, 2499]);
  assertEquals(rows.find((r) => r.start_min === 5)?.count, 9);
  assertEquals(rows.filter((r) => r.date === '2026-11-11').length, 1);
  assertEquals(log.deletes, 2497);
  assertEquals(log.maxInFlight <= 20, true);
  assertEquals(log.ranges.filter(([t]) => t === 'timetable_groups').map(([, a]) => a), [0, 1000, 2000]);
});

Deno.test('supabase replaceTimetable stops after one extra empty page when exactly 1000 rows exist', async () => {
  const existing = Array.from({ length: 1000 }, (_, i) => group('2026-11-10', i));
  const { admin, tables, log } = fakeAdmin({ timetable_groups: existing });
  await createSupabaseRepo(admin).replaceTimetable(['2026-11-10'], [], [group('2026-11-10', 0)] as never, []);
  assertEquals(log.ranges.filter(([t]) => t === 'timetable_groups').map(([, a, b]) => [a, b]), [[0, 999], [1000, 1999]]);
  assertEquals(tables.timetable_groups.length, 1);
});

Deno.test('supabase replaceTimetable issues no delete and rejects when the upsert fails', async () => {
  const { admin, tables, log } = fakeAdmin({ timetable_groups: [group('2026-11-10', 1), group('2026-11-10', 2)] }, { failUpsert: true });
  await assertRejects(() => createSupabaseRepo(admin).replaceTimetable(['2026-11-10'], [], [group('2026-11-10', 1)] as never, []));
  assertEquals(log.deletes, 0);
  assertEquals(log.selects, 0);
  assertEquals(tables.timetable_groups.length, 2);
});
