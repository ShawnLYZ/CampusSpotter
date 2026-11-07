import { beforeAll, describe, expect, it } from 'vitest';
import { LEVER_CATALOGUE, validateLevers } from '@engine/index.ts';
import type { InputBundle } from '@engine/index.ts';
import { normalWednesday } from '../../../shared/fixtures/engine/index.ts';
import { defaultLever } from './leverDefaults.ts';

let b: InputBundle;
beforeAll(async () => { b = await normalWednesday(); });

describe('defaultLever', () => {
  for (const spec of LEVER_CATALOGUE) {
    it(`${spec.kind} default validates with no warnings and is unchanged`, () => {
      const l = defaultLever(spec.kind, b);
      expect(l.kind).toBe(spec.kind);
      const r = validateLevers([l], b);
      expect(r.warnings).toEqual([]);
      expect(r.levers).toEqual([l]);
    });
  }
});
