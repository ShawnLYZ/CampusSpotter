import { readFileSync } from 'node:fs';
import { managementUrl } from './lib/project.ts';

// Runs SQL against the project in VITE_SUPABASE_URL via the Management API.
// usage: node --env-file=.env scripts/db-sql.ts (--query "<sql>" | --file <path>)
const URL = managementUrl('/database/query');

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const query = flag('--query');
const file = flag('--file');
if ((query === undefined) === (file === undefined)) {
  console.error('usage: db-sql.ts (--query "<sql>" | --file <path>)');
  process.exit(2);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is not set (run with node --env-file=.env)');
  process.exit(2);
}

const sql = query ?? readFileSync(file as string, 'utf8');
const res = await fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
if (res.ok) {
  console.log(text);
} else {
  console.error(`Supabase API HTTP ${res.status}: ${text}`);
  process.exitCode = 1;
}
