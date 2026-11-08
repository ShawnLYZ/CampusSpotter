import { assertEquals } from 'jsr:@std/assert@1';
import { handle } from './handler.ts';
Deno.test('returns the shared engine version', async () => {
  const res = handle(new Request('http://x/engine-version'));
  assertEquals((await res.json()).engineVersion, '1.0.2');
});
