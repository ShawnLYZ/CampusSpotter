// Stores what the pg_cron jobs need in Vault: `project_url` and `secret_key` (the project's sb_secret_ key), and removes
// the legacy `service_role_key` secret if an older setup left one. Prints only `ok`.
// Run: node --env-file=.env scripts/set-vault-secret.ts
import { accessToken, managementUrl, project, secretKey } from './lib/project.ts';
import { sqlLiteral } from './lib/sql.ts';

const upsert = (name: string, value: string): string => {
  const n = sqlLiteral(name, 'text');
  const v = sqlLiteral(value, 'text');
  return `select case
  when exists (select 1 from vault.secrets where name = ${n})
  then vault.update_secret((select id from vault.secrets where name = ${n}), ${v})::text
  else vault.create_secret(${v}, ${n})::text
end;`;
};

const token = accessToken();
const sql = [
  upsert('project_url', project().url),
  upsert('secret_key', await secretKey()),
  `delete from vault.secrets where name = 'service_role_key';`,
].join('\n');

const res = await fetch(managementUrl('/database/query'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ query: sql }),
});
if (!res.ok) {
  console.error(`vault upsert failed (HTTP ${res.status})`);
  process.exit(1);
}
console.log('ok');
