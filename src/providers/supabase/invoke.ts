import type { SupabaseClient } from '@supabase/supabase-js';
import { ProviderError, forbiddenWrite } from '../errors.ts';

interface FailedResponse { status: number; body: unknown }

async function readFailure(error: unknown): Promise<FailedResponse | null> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (typeof ctx !== 'object' || ctx === null || typeof (ctx as { status?: unknown }).status !== 'number') return null;
  const res = ctx as Response;
  let body: unknown = null;
  try { body = await res.json(); } catch { /* a failure without a JSON body still has a status */ }
  return { status: res.status, body };
}

/** Calls an Edge Function. `thing` completes "Guest accounts can’t change <thing>." when the function answers 403. */
export function createInvoke(client: SupabaseClient) {
  return async function invoke<T>(name: string, body: unknown, thing = 'that'): Promise<T> {
    const { data, error } = await client.functions.invoke(name, { body: body as Record<string, unknown> });
    if (!error) return data as T;
    const failed = await readFailure(error);
    if (failed?.status === 403) throw forbiddenWrite(thing);
    const b = failed?.body as { stale?: unknown; error?: unknown } | null | undefined;
    if (failed?.status === 503 && b?.stale === true) return failed.body as T;
    const detail = typeof b?.error === 'string' && b.error ? `: ${b.error}` : '';
    throw new ProviderError('unavailable', `That request couldn’t be completed${detail}.`);
  };
}
