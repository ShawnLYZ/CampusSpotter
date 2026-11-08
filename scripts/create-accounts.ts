// Creates/updates the manager and guest (demo role) accounts and writes their credentials into .env.local.
// Run: node --env-file=.env --env-file=.env.local scripts/create-accounts.ts
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { projectUrl } from './lib/project.ts';
import { serviceRoleKey } from './lib/serviceRole.ts';

const ENV_LOCAL = '.env.local';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function randomPassword(length = 20): string {
  const bytes = randomBytes(length);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** Replace KEY=value lines in place, preserving every other line and the line endings. */
function updateEnvFile(updates: Record<string, string>): void {
  const text = readFileSync(ENV_LOCAL, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const pending = new Map(Object.entries(updates));
  const out = lines.map((line) => {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
    if (m && pending.has(m[1])) {
      const v = pending.get(m[1])!;
      pending.delete(m[1]);
      return `${m[1]}=${v}`;
    }
    return line;
  });
  if (pending.size > 0) {
    // Insert new keys before a trailing empty line (if any) so the file still ends with a newline.
    const trailing = out[out.length - 1] === '' ? out.pop()! : null;
    for (const [k, v] of pending) out.push(`${k}=${v}`);
    if (trailing !== null) out.push(trailing);
  }
  writeFileSync(ENV_LOCAL, out.join(eol));
}

async function findUserId(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
}

interface Account {
  label: string;
  email: string;
  role: 'manager' | 'demo';
  displayName: string;
  envPassword: string | undefined;
}

/** Returns the password to write to .env.local, or null when it stays unchanged. */
async function upsert(admin: SupabaseClient, a: Account): Promise<string | null> {
  const existing = await findUserId(admin, a.email);
  const newPassword = a.envPassword ? null : randomPassword();
  let id: string;
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing, {
      email_confirm: true,
      app_metadata: { role: a.role },
      user_metadata: { display_name: a.displayName },
      ...(newPassword ? { password: newPassword } : {}),
    });
    if (error) throw new Error(`${a.label}: update failed: ${error.message}`);
    id = existing;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: a.email,
      password: a.envPassword || newPassword!,
      email_confirm: true,
      app_metadata: { role: a.role },
      user_metadata: { display_name: a.displayName },
    });
    if (error || !data.user) throw new Error(`${a.label}: create failed: ${error?.message}`);
    id = data.user.id;
  }
  // The signup trigger only runs on insert, so make sure an existing profile matches.
  const { error: pErr } = await admin.from('profiles').update({ role: a.role }).eq('id', id);
  if (pErr) throw new Error(`${a.label}: profile role update failed: ${pErr.message}`);
  const { data: prof, error: rErr } = await admin.from('profiles').select('role').eq('id', id).single();
  if (rErr || prof.role !== a.role) throw new Error(`${a.label}: profile role mismatch`);
  console.log(`${a.label}: ok`);
  return newPassword;
}

const managerEmail = process.env.MANAGER_EMAIL;
if (!managerEmail) throw new Error('MANAGER_EMAIL is not set: put your own email address in .env');

const admin = createClient(projectUrl(), await serviceRoleKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const demoEmail = process.env.VITE_DEMO_EMAIL || 'demo@campusspotter.app';

const managerPw = await upsert(admin, {
  label: 'manager',
  email: managerEmail,
  role: 'manager',
  displayName: 'APU Manager',
  envPassword: process.env.MANAGER_PASSWORD,
});
const demoPw = await upsert(admin, {
  label: 'demo',
  email: demoEmail,
  role: 'demo',
  displayName: 'Guest',
  envPassword: process.env.VITE_DEMO_PASSWORD,
});

const updates: Record<string, string> = { MANAGER_EMAIL: managerEmail, VITE_DEMO_EMAIL: demoEmail };
if (managerPw) updates.MANAGER_PASSWORD = managerPw;
if (demoPw) updates.VITE_DEMO_PASSWORD = demoPw;
updateEnvFile(updates);
console.log(`${ENV_LOCAL} updated (${Object.keys(updates).join(', ')})`);
