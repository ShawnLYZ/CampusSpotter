// Sets the Edge Function secrets GEMINI_API_KEY and GOOGLE_ROUTES_KEY on the live project.
// Run: node --env-file=.env scripts/set-function-secrets.ts
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { project } from './lib/project.ts';

const REF = project().ref;
const FILE = 'supabase/.env.functions'; // git-ignored
const NAMES = ['GEMINI_API_KEY', 'GOOGLE_ROUTES_KEY'] as const;

for (const n of NAMES) if (!process.env[n]) throw new Error(`${n} is not set in the environment`);

try {
  writeFileSync(FILE, NAMES.map((n) => `${n}=${process.env[n]}`).join('\n') + '\n', { mode: 0o600 });
  const r = spawnSync('supabase', ['secrets', 'set', '--env-file', FILE, '--project-ref', REF], {
    stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8', shell: true,
  });
  if (r.status !== 0) throw new Error(`supabase secrets set failed (exit ${r.status})`);
  console.log(`${NAMES.join(', ')} set`);
} finally {
  rmSync(FILE, { force: true });
}
