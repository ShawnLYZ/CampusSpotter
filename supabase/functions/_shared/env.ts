import { isSupabaseKey } from '../../../shared/supabase/keys.ts';

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}

/**
 * The sb_secret_ keys in a SUPABASE_SECRET_KEYS value (a JSON object of key name to key), the one named "default" first.
 * Throws when there is none. The legacy SUPABASE_SERVICE_ROLE_KEY is never read.
 */
export function parseSecretKeys(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('SUPABASE_SECRET_KEYS is not valid JSON');
  }
  const entries = typeof parsed === 'object' && parsed !== null ? Object.entries(parsed) : [];
  const keys = entries
    .sort(([a], [b]) => Number(b === 'default') - Number(a === 'default'))
    .map(([, v]) => v)
    .filter((v): v is string => isSupabaseKey(v as string, 'secret'));
  if (keys.length === 0) throw new Error('SUPABASE_SECRET_KEYS holds no sb_secret_ key');
  return keys;
}

/** The project's secret API keys, which the platform gives every Edge Function. */
export const secretKeys = (): string[] => parseSecretKeys(env('SUPABASE_SECRET_KEYS'));
