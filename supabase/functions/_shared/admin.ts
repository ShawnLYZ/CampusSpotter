import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { env, secretKeys } from './env.ts';

/** The function's own database client. It uses the project's default secret key, so it bypasses RLS. */
export function createAdminClient(keys: readonly string[] = secretKeys()): SupabaseClient {
  return createClient(env('SUPABASE_URL'), keys[0]);
}
