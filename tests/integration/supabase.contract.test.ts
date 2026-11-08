import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll } from 'vitest';
import { providerContract, type ContractSetup } from '../../src/providers/contract.ts';
import { createSupabaseProvider } from '../../src/providers/supabase/createSupabaseProvider.ts';
import { cleanupContractRows, newTracker, track } from './cleanup.ts';
import { liveEnv, serviceRoleKey } from './env.ts';

const env = liveEnv();
const serviceKey = await serviceRoleKey();

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const runId = Math.random().toString(36).slice(2, 8);

if (env && serviceKey) {
  const admin: SupabaseClient = createClient(env.url, serviceKey, opts);
  const tracker = newTracker();
  beforeAll(async () => { await cleanupContractRows(admin); }, 60_000);
  afterAll(async () => { await cleanupContractRows(admin, tracker); }, 60_000);

  let seq = 0;
  providerContract('supabase', async (): Promise<ContractSetup> => {
    const client = createClient(env.url, env.anonKey, opts);
    const provider = track(createSupabaseProvider(client), tracker);
    await provider.signIn(env.manager.email, env.manager.password);
    return {
      provider,
      capabilities: { roles: true },
      async seedScanItem(input) {
        const id = `test-${runId}-scan-${++seq}`;
        const { error } = await admin.from('disruptions').insert({
          id, title: input.title, type: input.type, kind: input.kind, venue: input.venue, start_at: input.startAt, end_at: input.endAt,
          expected_attendance: input.expectedAttendance, attendance_label: 'baseline', notes: input.notes, origin: 'scan',
        });
        if (error) throw new Error(`seedScanItem: ${error.message}`);
        return id;
      },
      async cleanup() { await client.auth.signOut({ scope: 'local' }); await cleanupContractRows(admin, tracker); },
    };
  });
}
