import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { csvTemplate } from '@bundle/csv.ts';
import { createSupabaseProvider } from '../../src/providers/supabase/createSupabaseProvider.ts';
import { cleanupContractRows, newTracker, track } from './cleanup.ts';
import { liveEnv, secretKey } from './env.ts';

const env = liveEnv();
const adminKey = await secretKey();
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!env || !adminKey)('demo role against the live provider', () => {
  const e = env!;
  let admin: SupabaseClient;
  const tracker = newTracker();
  beforeAll(async () => { admin = createClient(e.url, adminKey!, opts); await cleanupContractRows(admin); }, 60_000);
  afterAll(async () => { await cleanupContractRows(admin, tracker); }, 60_000);

  async function demoProvider() {
    const provider = track(createSupabaseProvider(createClient(e.url, e.publishableKey, opts)), tracker);
    await provider.signIn(e.demo.email, e.demo.password);
    return provider;
  }

  const input = {
    title: '[contract] demo create', type: 'manual', kind: 'other', venue: 'APU',
    startAt: '2026-12-01T09:00:00+08:00', endAt: '2026-12-01T17:00:00+08:00', expectedAttendance: 100, notes: null,
  } as const;

  it('cannot create a disruption', async () => {
    const p = await demoProvider();
    await expect(p.createDisruption({ ...input })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('cannot upload a baseline CSV', async () => {
    const p = await demoProvider();
    await expect(p.uploadBaselineCsv('energy_profiles', csvTemplate('energy_profiles'), { markVerified: false }))
      .rejects.toMatchObject({ code: 'forbidden' });
  });

  it('cannot override a disruption', async () => {
    const p = await demoProvider();
    await expect(p.overrideDisruption('weeknd-2026-11-04', { expectedAttendance: 1 })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('can record a decision', async () => {
    const p = await demoProvider();
    const ctx = { date: '2026-11-04' };
    const plan = (await p.generatePlans(ctx, 2000))[0];
    const made = await p.createDecision({ plan, ctx, notes: '[contract] demo decision', announcementText: 'Dear students,' });
    expect(made.decision.id).toBeTruthy();
  });
});
