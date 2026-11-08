import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createBrowserClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.');
  // The URL may carry a /rest/v1/ suffix; the client wants the bare origin.
  return createClient(new URL(url).origin, key, { auth: { persistSession: true, autoRefreshToken: true } });
}
