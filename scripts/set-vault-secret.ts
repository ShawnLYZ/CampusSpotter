// Upserts the Vault secrets the pg_cron jobs read: `service_role_key` and `project_url`. Prints only `ok`.
// Run: node --env-file=.env scripts/set-vault-secret.ts
import { projectRef, projectUrl } from './lib/project.ts';
import { serviceRoleKey } from './lib/serviceRole.ts';
import { sqlLiteral } from './lib/sql.ts';

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is not set (run with node --env-file=.env)');
  process.exit(2);
}

function upsert(name: string, value: string): string {
  const n = sqlLiteral(name, 'text');
  const v = sqlLiteral(value, 'text');
  return `select case
  when exists (select 1 from vault.secrets where name = ${n})
  then vault.update_secret((select id from vault.secrets where name = ${n}), ${v})::text
  else vault.create_secret(${v}, ${n})::text
end;`;
}

const sql = [upsert('service_role_key', await serviceRoleKey()), upsert('project_url', projectUrl())].join('\n');

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef()}/database/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ query: sql }),
});
if (!res.ok) {
  console.error(`vault upsert failed (HTTP ${res.status})`);
  process.exit(1);
}
console.log('ok');
