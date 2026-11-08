export interface LiveEnv {
  url: string;
  anonKey: string;
  manager: { email: string; password: string };
  demo: { email: string; password: string };
}

/** Live Supabase settings from process.env, or null when any is missing. */
export function liveEnv(): LiveEnv | null {
  const e = process.env;
  // The configured URL may carry a /rest/v1/ suffix; supabase-js needs the bare origin.
  const url = e.VITE_SUPABASE_URL ? new URL(e.VITE_SUPABASE_URL).origin : undefined;
  const anonKey = e.VITE_SUPABASE_ANON_KEY;
  const mEmail = e.MANAGER_EMAIL;
  const mPass = e.MANAGER_PASSWORD;
  const dEmail = e.VITE_DEMO_EMAIL;
  const dPass = e.VITE_DEMO_PASSWORD;
  if (!url || !anonKey || !mEmail || !mPass || !dEmail || !dPass) return null;
  return {
    url,
    anonKey,
    manager: { email: mEmail, password: mPass },
    demo: { email: dEmail, password: dPass },
  };
}

/**
 * The service-role key for the admin client (seeding and cleanup only). Uses SUPABASE_SERVICE_ROLE_KEY when set,
 * otherwise looks it up with the management token. Undefined only when the live settings are absent (the suites then skip);
 * when they are present but the key can't be obtained this throws, so the live suites can't pass by skipping silently.
 */
export async function serviceRoleKey(): Promise<string | undefined> {
  if (!liveEnv()) return undefined;
  const direct = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (direct) return direct;
  const fail = (why: string): never => {
    throw new Error(`Live Supabase tests are configured but the service-role key is unavailable: ${why}. Set SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ACCESS_TOKEN with a valid project URL.`);
  };
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = new URL(process.env.VITE_SUPABASE_URL!).hostname.split('.')[0];
  if (!token) return fail('neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ACCESS_TOKEN is set');
  let res: Response;
  try {
    res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return fail('the key lookup could not reach the management API');
  }
  if (!res.ok) return fail(`the key lookup with SUPABASE_ACCESS_TOKEN answered HTTP ${res.status}`);
  const keys = (await res.json()) as Array<{ name?: string; api_key?: string | null }>;
  return keys.find((k) => k.name === 'service_role')?.api_key ?? fail('the project has no service_role key');
}
