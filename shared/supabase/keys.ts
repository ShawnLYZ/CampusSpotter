// Supabase API keys. Only the new keys are accepted: the legacy JWT keys (anon, service_role) are being removed by Supabase.
export type SupabaseKeyKind = 'publishable' | 'secret';

const PREFIX: Record<SupabaseKeyKind, string> = { publishable: 'sb_publishable_', secret: 'sb_secret_' };

export const isSupabaseKey = (value: string | null | undefined, kind: SupabaseKeyKind): boolean =>
  typeof value === 'string' && value.startsWith(PREFIX[kind]) && value.length > PREFIX[kind].length;

/** Why the setting `name` (holding `value`) is not a usable key of `kind`, or null when it is. Never includes the value. */
export function supabaseKeyProblem(name: string, value: string | null | undefined, kind: SupabaseKeyKind): string | null {
  if (!value) return `${name} is not set.`;
  if (isSupabaseKey(value, kind)) return null;
  const want = `the ${kind} key from Supabase (Project Settings → API Keys), which starts with ${PREFIX[kind]}`;
  if (value.startsWith('eyJ')) return `${name} holds a legacy anon or service_role key, which CampusSpotter no longer accepts. Use ${want}.`;
  if (kind === 'publishable' && value.startsWith(PREFIX.secret)) {
    return `${name} holds a secret key, which must never be used in the website. Use ${want}.`;
  }
  return `${name} must be ${want}.`;
}

/** The value when it is a usable key of `kind`; otherwise throws with the reason. */
export function requireSupabaseKey(name: string, value: string | null | undefined, kind: SupabaseKeyKind): string {
  const problem = supabaseKeyProblem(name, value, kind);
  if (problem) throw new Error(problem);
  return value!;
}
