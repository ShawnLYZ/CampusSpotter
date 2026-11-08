// The Supabase project these scripts act on, read from VITE_SUPABASE_URL (https://<project-id>.supabase.co).

/** The project's base address, such as https://abcdefghijklmnopqrst.supabase.co (any path, like /rest/v1/, is dropped). */
export function projectUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.VITE_SUPABASE_URL;
  if (!raw) throw new Error('VITE_SUPABASE_URL is not set (run with node --env-file=.env)');
  try {
    return new URL(raw).origin;
  } catch {
    throw new Error(`VITE_SUPABASE_URL is not a web address: ${raw}`);
  }
}

/** The project ID (also called the project ref), such as abcdefghijklmnopqrst. */
export function projectRef(env: NodeJS.ProcessEnv = process.env): string {
  const host = new URL(projectUrl(env)).hostname;
  const ref = host.endsWith('.supabase.co') ? host.slice(0, -'.supabase.co'.length) : '';
  if (!/^[a-z0-9]+$/.test(ref)) throw new Error(`VITE_SUPABASE_URL must look like https://<project-id>.supabase.co (got ${host})`);
  return ref;
}
