import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createInvoke } from './invoke.ts';

const failing = (status: number, body: unknown): SupabaseClient => ({
  functions: { invoke: async () => ({ data: null, error: { context: new Response(JSON.stringify(body), { status }) } }) },
}) as unknown as SupabaseClient;

describe('invoke', () => {
  it('returns the data on success', async () => {
    const client = { functions: { invoke: async () => ({ data: { ok: 1 }, error: null }) } } as unknown as SupabaseClient;
    expect(await createInvoke(client)('f', {})).toEqual({ ok: 1 });
  });
  it('maps 403 to a forbidden error', async () => {
    await expect(createInvoke(failing(403, { error: 'no' }))('baseline-import', {}, 'baseline data'))
      .rejects.toMatchObject({ code: 'forbidden', message: 'Guest accounts can’t change baseline data.' });
  });
  it('keeps the body of a stale 503', async () => {
    const body = { stale: true, estimates: [] };
    expect(await createInvoke(failing(503, body))('ai-estimate', {})).toEqual(body);
  });
  it('maps other failures to unavailable with the function message', async () => {
    await expect(createInvoke(failing(503, { error: 'AI is unavailable right now' }))('ai-ask', {}))
      .rejects.toMatchObject({ code: 'unavailable', message: expect.stringContaining('AI is unavailable right now') });
  });
  it('maps a network failure without a response to unavailable', async () => {
    const client = { functions: { invoke: async () => ({ data: null, error: new Error('offline') }) } } as unknown as SupabaseClient;
    await expect(createInvoke(client)('f', {})).rejects.toMatchObject({ code: 'unavailable' });
  });
});
