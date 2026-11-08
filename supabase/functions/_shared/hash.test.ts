import { assertEquals, assert } from 'jsr:@std/assert@1';
import { canonicalJson, sha256Hex } from './hash.ts';

Deno.test('canonicalJson sorts keys recursively with no whitespace', () => {
  assertEquals(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } }), '{"a":{"c":[3,{"e":2,"f":1}],"d":2},"b":1}');
});

Deno.test('sha256Hex matches the known digest of abc', async () => {
  assert((await sha256Hex('abc')).startsWith('ba7816bf'));
});
