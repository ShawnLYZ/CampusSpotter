import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { scanForSecrets } from './lib/secrets.ts';

const dist = 'dist';
if (!existsSync(dist)) {
  console.error('dist/ does not exist; run vite build first');
  process.exit(1);
}

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));

const files = walk(dist).map((path) => ({ path: path.replaceAll('\\', '/'), content: readFileSync(path, 'utf8') }));
const dbPassword = process.env.SUPABASE_DB_PASSWORD || undefined;
if (!dbPassword) console.error('SUPABASE_DB_PASSWORD is not set; the db_password rule was skipped');
const findings = scanForSecrets(files, { dbPassword, geminiKey: process.env.GEMINI_API_KEY || undefined });

if (findings.length > 0) {
  for (const f of findings) console.error(`${f.kind} in ${f.file}: ${f.excerpt}`);
  console.error(`${findings.length} server secret finding(s) in dist/`);
  process.exit(1);
}
console.log('No server secrets in dist/');
