import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { parseSecretKeys } from './env.ts';

Deno.test('parseSecretKeys returns the sb_secret_ keys with "default" first', () => {
  const raw = JSON.stringify({ billing: 'sb_secret_bbb', default: 'sb_secret_ddd', other: 'sb_secret_ooo' });
  assertEquals(parseSecretKeys(raw), ['sb_secret_ddd', 'sb_secret_bbb', 'sb_secret_ooo']);
});

Deno.test('parseSecretKeys ignores anything that is not a secret key', () => {
  const raw = JSON.stringify({ legacy: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig', pub: 'sb_publishable_x', n: 7, default: 'sb_secret_ddd' });
  assertEquals(parseSecretKeys(raw), ['sb_secret_ddd']);
});

Deno.test('parseSecretKeys throws when there is no secret key or the JSON is bad', () => {
  assertThrows(() => parseSecretKeys('{}'), Error, 'holds no sb_secret_ key');
  assertThrows(() => parseSecretKeys(JSON.stringify({ default: 'eyJ.legacy.jwt' })), Error, 'holds no sb_secret_ key');
  assertThrows(() => parseSecretKeys('null'), Error, 'holds no sb_secret_ key');
  assertThrows(() => parseSecretKeys('not json'), Error, 'not valid JSON');
});
