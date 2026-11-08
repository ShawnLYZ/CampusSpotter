import { secretKey as projectSecretKey } from '../../scripts/lib/project.ts';
import { requireSupabaseKey } from '../../shared/supabase/keys.ts';

export interface LiveEnv {
  url: string;
  publishableKey: string;
  manager: { email: string; password: string };
  demo: { email: string; password: string };
}

/** Live Supabase settings from process.env, or null when any is missing. A legacy key fails instead of skipping. */
export function liveEnv(): LiveEnv | null {
  const e = process.env;
  // The configured URL may carry a /rest/v1/ suffix; supabase-js needs the bare origin.
  const url = e.VITE_SUPABASE_URL ? new URL(e.VITE_SUPABASE_URL).origin : undefined;
  const key = e.VITE_SUPABASE_PUBLISHABLE_KEY;
  const mEmail = e.MANAGER_EMAIL;
  const mPass = e.MANAGER_PASSWORD;
  const dEmail = e.VITE_DEMO_EMAIL;
  const dPass = e.VITE_DEMO_PASSWORD;
  if (!url || !key || !mEmail || !mPass || !dEmail || !dPass) return null;
  return {
    url,
    publishableKey: requireSupabaseKey('VITE_SUPABASE_PUBLISHABLE_KEY', key, 'publishable'),
    manager: { email: mEmail, password: mPass },
    demo: { email: dEmail, password: dPass },
  };
}

/**
 * The secret key for the admin client (seeding and cleanup only): SUPABASE_SECRET_KEY when set, otherwise looked up with
 * the management token. Undefined only when the live settings are absent (the suites then skip); when they are present
 * but the key can't be obtained this throws, so the live suites can't pass by skipping silently.
 */
export async function secretKey(): Promise<string | undefined> {
  if (!liveEnv()) return undefined;
  try {
    return await projectSecretKey();
  } catch (e) {
    const why = e instanceof Error ? e.message : 'unknown error';
    throw new Error(`Live Supabase tests are configured but the secret key is unavailable: ${why}. Set SUPABASE_SECRET_KEY, or SUPABASE_ACCESS_TOKEN with a valid project URL.`);
  }
}
