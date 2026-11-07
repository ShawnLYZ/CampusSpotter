import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION } from './version.ts';
describe('engine version', () => {
  it('is 1.0.1', () => { expect(ENGINE_VERSION).toBe('1.0.1'); });
});
