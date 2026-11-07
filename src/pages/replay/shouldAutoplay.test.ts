import { describe, expect, it } from 'vitest';
import { shouldAutoplay } from './shouldAutoplay.ts';

describe('shouldAutoplay', () => {
  it('autoplays the ready day view when the presenter is off', () => {
    expect(shouldAutoplay(true, true, false)).toBe(true);
  });
  it('never autoplays while the presenter is active', () => {
    expect(shouldAutoplay(true, true, true)).toBe(false);
  });
  it('does not autoplay other milestones or an unready forecast', () => {
    expect(shouldAutoplay(false, true, false)).toBe(false);
    expect(shouldAutoplay(true, false, false)).toBe(false);
  });
});
