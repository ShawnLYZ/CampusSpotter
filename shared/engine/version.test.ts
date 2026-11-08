import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION } from './version.ts';
describe('engine version', () => {
  it('is 1.0.2', () => { expect(ENGINE_VERSION).toBe('1.0.2'); });
});
