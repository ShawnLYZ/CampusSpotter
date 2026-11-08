// Disables public signup and pins the site URL on the live Supabase project.
// Run: node --env-file=.env scripts/auth-config.ts
import { projectRef } from './lib/project.ts';

const REF = projectRef();

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is not set');

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    disable_signup: true,
    site_url: 'http://localhost:5173',
    uri_allow_list: 'http://localhost:5173/**',
  }),
});

if (!res.ok) {
  console.error(`auth config: failed (${res.status})`);
  process.exit(1);
}

const check = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  headers: { Authorization: `Bearer ${token}` },
});
const cfg = check.ok ? ((await check.json()) as { disable_signup?: boolean }) : null;
if (cfg?.disable_signup !== true) {
  console.error('auth config: verification failed (disable_signup is not true)');
  process.exit(1);
}
console.log('auth config: ok');

export {};
