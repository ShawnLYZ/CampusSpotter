import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createDataMethods } from './dataMethods.ts';
import { isStaleEstimates } from '../staleEstimates.ts';

const est = (id: string) => ({ key: 'k', disruptionId: id, likely: 1, low: 0, high: 2, unit: 'people', reasoning: '', confidence: 'low', model: 'm', createdAt: 'x', clamped: false });

function methods(replies: Record<string, () => unknown>) {
  const bundle = { context: { disruptions: Object.keys(replies).map((id) => ({ id, kind: 'concert' })) } };
  const invoke = async (_n: string, body: { disruptionId: string }) => replies[body.disruptionId]();
  return createDataMethods({} as SupabaseClient, invoke as never, {
    getInputBundle: (async () => bundle) as never, currentUser: async () => null, emitBaseline: () => {},
  });
}

describe('refreshEstimates', () => {
  const ctx = { date: '2026-11-05' };
  it('merges the estimates that came back and marks the result stale when one call failed', async () => {
    const m = methods({ a: () => ({ estimates: [est('a')] }), b: () => { throw new Error('boom'); } });
    const out = await m.refreshEstimates(ctx);
    expect(out).toHaveLength(1);
    expect(isStaleEstimates(out)).toBe(true);
  });
  it('is not stale when every call succeeds', async () => {
    const out = await methods({ a: () => ({ estimates: [est('a')] }), b: () => ({ estimates: [est('b')] }) }).refreshEstimates(ctx);
    expect(out).toHaveLength(2);
    expect(isStaleEstimates(out)).toBe(false);
  });
  it('throws unavailable when every call failed', async () => {
    const m = methods({ a: () => { throw new Error('x'); }, b: () => { throw new Error('y'); } });
    await expect(m.refreshEstimates(ctx)).rejects.toMatchObject({ code: 'unavailable' });
  });
});
