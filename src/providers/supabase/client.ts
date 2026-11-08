import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseKey } from '../../../shared/supabase/keys.ts';

export function createBrowserClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) throw new Error('VITE_SUPABASE_URL is not set.');
  // Only the publishable key: a legacy anon key or a secret key is refused with the reason.
  const key = requireSupabaseKey('VITE_SUPABASE_PUBLISHABLE_KEY', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined, 'publishable');
  // The URL may carry a /rest/v1/ suffix; the client wants the bare origin.
  return createClient(new URL(url).origin, key, { auth: { persistSession: true, autoRefreshToken: true } });
}
