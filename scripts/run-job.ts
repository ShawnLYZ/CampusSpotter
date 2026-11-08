// Invokes one sync function now with the project's secret key (as pg_cron does) and prints the status and JSON response.
// Run: node --env-file=.env scripts/run-job.ts <name>
import { project, secretKey } from './lib/project.ts';

const name = process.argv[2];
if (!name) {
  console.error('usage: run-job.ts <function-name>');
  process.exit(2);
}
const res = await fetch(`${project().url}/functions/v1/${name}`, {
  method: 'POST',
  headers: { apikey: await secretKey(), 'Content-Type': 'application/json' },
  body: '{}',
});
console.log(`${name}: ${res.status}`);
console.log((await res.text()).slice(0, 4000));
if (!res.ok) process.exit(1);
