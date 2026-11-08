import { assertEquals } from 'jsr:@std/assert@1';
import { type JsonSchema, validateJson } from './jsonschema.ts';

const schema: JsonSchema = {
  type: 'object',
  required: ['levers'],
  additionalProperties: false,
  properties: {
    levers: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: { type: 'string', enum: ['a', 'b'] },
          count: { type: 'number', minimum: 1 },
        },
      },
    },
  },
};

Deno.test('valid value gives no errors', () => {
  assertEquals(validateJson(schema, { levers: [{ kind: 'a', count: 2 }] }), []);
});

Deno.test('missing required field is path-specific', () => {
  assertEquals(validateJson(schema, {}), ['$.levers: required']);
  assertEquals(validateJson(schema, { levers: [{}] }), ['$.levers[0].kind: required']);
});

Deno.test('enum, minimum, maxItems and extra property violations', () => {
  assertEquals(validateJson(schema, { levers: [{ kind: 'z' }] }), ['$.levers[0].kind: not in enum']);
  assertEquals(validateJson(schema, { levers: [{ kind: 'a', count: 0 }] }), ['$.levers[0].count: below minimum']);
  assertEquals(validateJson(schema, { levers: [{ kind: 'a' }, { kind: 'a' }, { kind: 'a' }] }), ['$.levers: too many items']);
  assertEquals(validateJson(schema, { levers: [], extra: 1 }), ['$.extra: unexpected property']);
});

Deno.test('type errors, type arrays, maxLength, maximum, minItems', () => {
  assertEquals(validateJson({ type: 'string' }, 3), ['$: expected string']);
  assertEquals(validateJson({ type: ['string', 'null'] }, null), []);
  assertEquals(validateJson({ type: 'integer' }, 1.5), ['$: expected integer']);
  assertEquals(validateJson({ type: 'string', maxLength: 2 }, 'abc'), ['$: too long']);
  assertEquals(validateJson({ type: 'number', maximum: 5 }, 6), ['$: above maximum']);
  assertEquals(validateJson({ type: 'array', minItems: 1 }, []), ['$: too few items']);
});

Deno.test('anyOf accepts number and array forms', () => {
  const s: JsonSchema = { anyOf: [{ type: 'number' }, { type: 'array' }] };
  assertEquals(validateJson(s, 3), []);
  assertEquals(validateJson(s, [1, 2]), []);
  assertEquals(validateJson(s, 'x').length, 1);
});
