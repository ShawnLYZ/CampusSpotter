import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseRowsClient } from './rowsClient.ts';

function fake(pages: unknown[][], calls: string[]): SupabaseClient {
  const q: Record<string, unknown> = {};
  for (const op of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in']) q[op] = (c: string, v: unknown) => { calls.push(`${op}:${c}:${JSON.stringify(v)}`); return q; };
  q.select = () => q;
  q.order = (c: string) => { calls.push(`order:${c}`); return q; };
  q.range = async (from: number) => ({ data: pages[from / 1000] ?? [], error: null });
  return { from: () => q } as unknown as SupabaseClient;
}

describe('supabaseRowsClient', () => {
  it('maps each filter operator onto the query builder', async () => {
    const calls: string[] = [];
    const rows = await supabaseRowsClient(fake([[{ a: 1 }]], calls)).select('disruptions', [
      { column: 'status', op: 'eq', value: 'active' }, { column: 'end_at', op: 'gt', value: 'x' }, { column: 'type', op: 'in', value: ['a', 'b'] },
    ]);
    expect(calls).toEqual(['eq:status:"active"', 'gt:end_at:"x"', 'in:type:["a","b"]', 'order:id']);
    expect(rows).toEqual([{ a: 1 }]);
  });
  it('pages past the 1000-row cap', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ i }));
    const rows = await supabaseRowsClient(fake([full, [{ i: 1000 }]], [])).select('rooms');
    expect(rows).toHaveLength(1001);
  });
  it('orders paging by every primary-key column', async () => {
    const calls: string[] = [];
    await supabaseRowsClient(fake([[]], calls)).select('prayer_times');
    expect(calls).toEqual(['order:date', 'order:zone']);
  });
  it('throws the builder error', async () => {
    const q = { select: () => q, order: () => q, range: async () => ({ data: null, error: { code: 'X' } }) };
    await expect(supabaseRowsClient({ from: () => q } as unknown as SupabaseClient).select('rooms')).rejects.toEqual({ code: 'X' });
  });
});
