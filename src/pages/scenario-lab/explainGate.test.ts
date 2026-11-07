import { describe, expect, it } from 'vitest';
import { explainGate } from './explainGate.ts';

describe('explainGate', () => {
  it('waits when nothing is pending', () => {
    expect(explainGate(false, 'ready', true)).toBe('wait');
    expect(explainGate(false, 'error', false)).toBe('wait');
  });
  it('waits while the forecast loads', () => {
    expect(explainGate(true, 'loading', false)).toBe('wait');
    expect(explainGate(true, 'ready', false)).toBe('wait');
  });
  it('explains once the forecasts are ready', () => {
    expect(explainGate(true, 'ready', true)).toBe('explain');
  });
  it('fails when the forecast errored', () => {
    expect(explainGate(true, 'error', false)).toBe('fail');
  });
});
