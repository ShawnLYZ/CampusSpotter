// Invokes one sync function now as the service role and prints the status and JSON response.
// Run: node --env-file=.env scripts/run-job.ts <name>
import { projectUrl } from './lib/project.ts';
import { serviceRoleKey } from './lib/serviceRole.ts';

const name = process.argv[2];
if (!name) {
  console.error('usage: run-job.ts <function-name>');
  process.exit(2);
}
const res = await fetch(`${projectUrl()}/functions/v1/${name}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${await serviceRoleKey()}`, 'Content-Type': 'application/json' },
  body: '{}',
});
console.log(`${name}: ${res.status}`);
console.log((await res.text()).slice(0, 4000));
if (!res.ok) process.exit(1);
