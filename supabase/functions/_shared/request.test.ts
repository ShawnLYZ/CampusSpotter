import { assertEquals } from 'jsr:@std/assert@1';
import { RepoError } from './repo.ts';
import { errorCategory, serveRequest } from './request.ts';
import { authedRequest, seededRepo } from './testkit.ts';

async function logged(thrown: unknown): Promise<{ status: number; lines: unknown[][] }> {
  const lines: unknown[][] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { lines.push(a); };
  try {
    const res = await serveRequest(authedRequest({}), seededRepo(), () => Promise.reject(thrown));
    return { status: res.status, lines };
  } finally {
    console.error = orig;
  }
}

Deno.test('repo failures log the fixed label, never the message', async () => {
  const { status, lines } = await logged(new RepoError('insertPlans', 'value too long: SECRET-USER-TEXT'));
  assertEquals(status, 500);
  assertEquals(lines, [['unhandled error', 'RepoError insertPlans']]);
});

Deno.test('other errors log only their name', async () => {
  const { lines } = await logged(new TypeError('SECRET-USER-TEXT'));
  assertEquals(lines, [['unhandled error', 'TypeError']]);
  assertEquals(errorCategory('x'), 'unknown');
});
