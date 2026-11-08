import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { createSupabaseProvider } from './createSupabaseProvider.ts';

function fake(auth: object, profile: { data: unknown; error: unknown } = { data: null, error: null }): SupabaseClient {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => profile };
  return { auth, from: () => q } as unknown as SupabaseClient;
}

describe('supabase currentUser', () => {
  it('is null when there is no session', async () => {
    const p = createSupabaseProvider(fake({ getSession: async () => ({ data: { session: null }, error: null }) }));
    expect(await p.currentUser()).toBeNull();
  });
  it('is null when the refresh token is rejected', async () => {
    const error = new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found');
    const p = createSupabaseProvider(fake({ getSession: async () => ({ data: { session: null }, error }) }));
    expect(await p.currentUser()).toBeNull();
  });
  it('is unavailable on a network failure', async () => {
    const error = new AuthRetryableFetchError('offline', 0);
    const p = createSupabaseProvider(fake({ getSession: async () => ({ data: { session: null }, error }) }));
    await expect(p.currentUser()).rejects.toMatchObject({ code: 'unavailable' });
  });
  it('maps the profile to an AppUser', async () => {
    const p = createSupabaseProvider(fake(
      { getSession: async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }) },
      { data: { display_name: 'Ana', role: 'manager' }, error: null },
    ));
    expect(await p.currentUser()).toEqual({ id: 'u1', displayName: 'Ana', role: 'manager' });
  });
  it('signs out when sign-in succeeds but the profile is missing', async () => {
    let signedOut = false;
    const p = createSupabaseProvider(fake({
      signInWithPassword: async () => ({ data: { user: { id: 'u1' } }, error: null }),
      signOut: async (o: unknown) => { signedOut = JSON.stringify(o) === '{"scope":"local"}'; return { error: null }; },
    }));
    await expect(p.signIn('a@b.c', 'pw')).rejects.toMatchObject({ code: 'forbidden' });
    expect(signedOut).toBe(true);
  });
});

describe('supabase listDisruptions window', () => {
  it('matches on own or override times in one or() filter, with the status filter separate', async () => {
    const calls: string[] = [];
    const q: Record<string, unknown> = {
      select: () => q, order: () => q,
      or: (f: string) => { calls.push(`or:${f}`); return q; },
      eq: (c: string, v: string) => { calls.push(`eq:${c}:${v}`); return q; },
      then: (ok: (r: unknown) => void) => ok({ data: [], error: null }),
    };
    await createSupabaseProvider({ from: () => q } as unknown as SupabaseClient).listDisruptions({ from: '2026-11-05', to: '2026-11-12' });
    expect(calls).toEqual([
      'or:and(or(end_at.gte."2026-11-05T00:00:00+08:00",override_end_at.gte."2026-11-05T00:00:00+08:00"),'
      + 'or(start_at.lte."2026-11-12T23:59:59+08:00",override_start_at.lte."2026-11-12T23:59:59+08:00"))',
      'eq:status:active',
    ]);
  });
});

describe('supabase auth subscription', () => {
  it('signals handlers when the session is signed out, not on other events, and unsubscribes', () => {
    vi.useFakeTimers();
    try {
      let fire: (e: string) => void = () => {};
      const unsub = vi.fn();
      const client = { auth: { onAuthStateChange: (cb: (e: string) => void) => { fire = cb; return { data: { subscription: { unsubscribe: unsub } } }; } } };
      const handler = vi.fn();
      const off = createSupabaseProvider(client as unknown as SupabaseClient).subscribe('auth', handler);
      fire('TOKEN_REFRESHED');
      vi.advanceTimersByTime(10);
      expect(handler).not.toHaveBeenCalled();
      fire('SIGNED_OUT');
      vi.advanceTimersByTime(10);
      expect(handler).toHaveBeenCalledTimes(1);
      off();
      expect(unsub).toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});

describe('supabase signOut', () => {
  it('ends only this session', async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    await createSupabaseProvider(fake({ signOut })).signOut();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('is unavailable when sign-out fails', async () => {
    const p = createSupabaseProvider(fake({ signOut: async () => ({ error: new Error('x') }) }));
    await expect(p.signOut()).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('supabase subscribe', () => {
  it('wires the table with a debounce, and unsubscribing removes the channel and cancels the pending call', () => {
    vi.useFakeTimers();
    try {
      const names: string[] = [];
      const removed: unknown[] = [];
      let onChange: () => void = () => {};
      const ch = { on: (_t: string, f: { table: string }, cb: () => void) => { names.push(f.table); onChange = cb; return ch; }, subscribe: () => ch };
      const client = { channel: (n: string) => { names.push(n); return ch; }, removeChannel: (c: unknown) => { removed.push(c); return Promise.resolve('ok'); } };
      const p = createSupabaseProvider(client as unknown as SupabaseClient);
      const handler = vi.fn();
      const off = p.subscribe('decisions', handler);
      p.subscribe('decisions', () => {});
      expect(names).toEqual(['cs-decisions-1', 'decisions', 'cs-decisions-2', 'decisions']);
      onChange();
      off();
      vi.advanceTimersByTime(1000);
      expect(handler).not.toHaveBeenCalled();
      expect(removed).toEqual([ch]);
    } finally { vi.useRealTimers(); }
  });
});
