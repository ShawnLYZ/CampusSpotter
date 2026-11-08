// The Supabase project and its API keys for the setup scripts, read from .env. Only the new keys are accepted.
import { isSupabaseKey, requireSupabaseKey } from '../../shared/supabase/keys.ts';

const MANAGEMENT_API = 'https://api.supabase.com/v1';

/** The project origin and ID from VITE_SUPABASE_URL. A trailing path such as /rest/v1/ is allowed. */
export function project(raw = process.env.VITE_SUPABASE_URL): { url: string; ref: string } {
  const bad = (): never => {
    throw new Error('VITE_SUPABASE_URL must look like https://<project-id>.supabase.co');
  };
  if (!raw) return bad();
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return bad();
  }
  const ref = /^([a-z0-9]+)\.supabase\.co$/.exec(u.hostname)?.[1];
  if (u.protocol !== 'https:' || !ref) return bad();
  return { url: u.origin, ref };
}

/** A Management API URL for this project, e.g. managementUrl('/database/query'). */
export const managementUrl = (path: string): string => `${MANAGEMENT_API}/projects/${project().ref}${path}`;

export function accessToken(): string {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is not set');
  return token;
}

export const publishableKey = (): string =>
  requireSupabaseKey('VITE_SUPABASE_PUBLISHABLE_KEY', process.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'publishable');

interface ApiKeyRow { name?: string; type?: string; api_key?: string | null }

/** The secret key in a Management API api-keys listing: the one named "default", else the first. Legacy keys are skipped. */
export function pickSecretKey(rows: unknown): string {
  const secrets = (Array.isArray(rows) ? (rows as ApiKeyRow[]) : []).filter((k) => k.type === 'secret' && isSupabaseKey(k.api_key, 'secret'));
  const hit = secrets.find((k) => k.name === 'default') ?? secrets[0];
  if (!hit) throw new Error('the project has no secret API key; create one in Supabase under Project Settings → API Keys');
  return hit.api_key!;
}

/**
 * The project's secret key: SUPABASE_SECRET_KEY when set (it must start with sb_secret_), otherwise looked up with
 * SUPABASE_ACCESS_TOKEN through the Management API.
 */
export async function secretKey(): Promise<string> {
  const fromEnv = process.env.SUPABASE_SECRET_KEY;
  if (fromEnv) return requireSupabaseKey('SUPABASE_SECRET_KEY', fromEnv, 'secret');
  if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error('Neither SUPABASE_SECRET_KEY nor SUPABASE_ACCESS_TOKEN is set');
  const res = await fetch(managementUrl('/api-keys?reveal=true'), { headers: { Authorization: `Bearer ${accessToken()}` } });
  if (!res.ok) throw new Error(`the secret key lookup with SUPABASE_ACCESS_TOKEN answered HTTP ${res.status}`);
  return pickSecretKey(await res.json());
}
