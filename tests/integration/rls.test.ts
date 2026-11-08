import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { liveEnv } from './env.ts';

const env = liveEnv();

function client(e: NonNullable<typeof env>): SupabaseClient {
  return createClient(e.url, e.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedIn(e: NonNullable<typeof env>, who: 'manager' | 'demo') {
  const c = client(e);
  const { data, error } = await c.auth.signInWithPassword(e[who]);
  if (error || !data.user) throw new Error(`${who} sign-in failed: ${error?.message}`);
  return { c, userId: data.user.id };
}

describe.skipIf(!env)('RLS against the live project', () => {
  const e = env!;

  it('anon cannot read baseline_values', async () => {
    const { data, error } = await client(e).from('baseline_values').select();
    if (error) {
      // Only a permission error counts; transport/path errors must fail.
      expect(error.code).toBe('42501');
    } else {
      expect(data).toEqual([]);
    }
  });

  it('anon signUp is rejected', async () => {
    const { error } = await client(e).auth.signUp({
      email: 'x@example.com',
      password: 'Abcdef123456!',
    });
    expect(error?.code).toBe('signup_disabled');
  });

  it('demo reads baseline_values but cannot write protected tables', async () => {
    const { c } = await signedIn(e, 'demo');
    const read = await c.from('baseline_values').select();
    expect(read.error).toBeNull();
    expect((read.data ?? []).length).toBeGreaterThan(0);

    const readTargets = async () => {
      const b = await c.from('baseline_values').select('unit').eq('key', 'fleet_size').single();
      const st = await c.from('settings').select('*').eq('id', 1).single();
      const d = await c
        .from('disruptions')
        .select('override_attendance')
        .eq('id', 'weeknd-2026-11-04')
        .single();
      expect(b.error).toBeNull();
      expect(st.error).toBeNull();
      expect(d.error).toBeNull();
      expect(b.data).toBeTruthy();
      expect(st.data).toBeTruthy();
      expect(d.data).toBeTruthy();
      return { b: b.data, st: st.data, d: d.data };
    };
    const before = await readTargets();

    const base = await c.from('baseline_values').update({ unit: 'x' }).eq('key', 'fleet_size').select();
    expect(base.data ?? []).toEqual([]);

    const settings = await c.from('settings').update({ updated_at: new Date().toISOString() }).eq('id', 1).select();
    expect(settings.data ?? []).toEqual([]);

    const disr = await c
      .from('disruptions')
      .update({ override_attendance: 1 })
      .eq('id', 'weeknd-2026-11-04')
      .select();
    expect(disr.data ?? []).toEqual([]);

    expect(await readTargets()).toEqual(before);
  });

  it('demo can insert and delete a forecasts row', async () => {
    const { c } = await signedIn(e, 'demo');
    const ins = await c
      .from('forecasts')
      .insert({
        context_date: '2026-11-05',
        scenario_kind: 'no_action',
        levers: {},
        summary: {},
        per_step: [],
        input_snapshot_hash: 'rls-test',
        engine_version: '1.0.1',
      })
      .select();
    expect(ins.error).toBeNull();
    expect(ins.data).toHaveLength(1);
    const id = ins.data![0].id;
    const del = await c.from('forecasts').delete().eq('id', id).select();
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
  });

  it('manager can update baseline_values', async () => {
    const { c } = await signedIn(e, 'manager');
    const cur = await c.from('baseline_values').select('description').eq('key', 'fleet_size').single();
    expect(cur.error).toBeNull();
    const upd = await c
      .from('baseline_values')
      .update({ description: cur.data!.description })
      .eq('key', 'fleet_size')
      .select();
    expect(upd.error).toBeNull();
    expect(upd.data).toHaveLength(1);
  });

  it('manager profile has role manager', async () => {
    const { c, userId } = await signedIn(e, 'manager');
    const { data, error } = await c.from('profiles').select('role').eq('id', userId);
    expect(error).toBeNull();
    expect(data).toEqual([{ role: 'manager' }]);
  });
});
