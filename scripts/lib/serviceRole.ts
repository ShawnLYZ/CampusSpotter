import { projectRef } from './project.ts';

// The legacy JWT service_role key: from SUPABASE_SERVICE_ROLE_KEY if set, else the Management API api-keys lookup.
export async function serviceRoleKey(): Promise<string> {
  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (fromEnv) return fromEnv;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ACCESS_TOKEN is set');
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef()}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`api-keys lookup failed (${res.status})`);
  const keys = (await res.json()) as Array<{ name?: string; api_key?: string | null }>;
  const key = keys.find((k) => k.name === 'service_role')?.api_key;
  if (!key) throw new Error('service_role key not found');
  return key;
}
