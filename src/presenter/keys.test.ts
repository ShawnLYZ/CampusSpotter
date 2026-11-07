import { describe, expect, it } from 'vitest';
import { shouldHandleKey } from './keys.ts';

const k = (key: string, tag = 'DIV', mods: { altKey?: boolean; shiftKey?: boolean } = {}) =>
  ({ key, altKey: false, shiftKey: false, ...mods, target: { tagName: tag } });

describe('shouldHandleKey', () => {
  it('ignores auto-repeat key events', () => {
    expect(shouldHandleKey({ ...k('ArrowRight'), repeat: true }, true)).toBeNull();
    expect(shouldHandleKey({ ...k('P', 'DIV', { altKey: true, shiftKey: true }), repeat: true }, false)).toBeNull();
  });
  it('Alt+Shift+P toggles, active or not', () => {
    expect(shouldHandleKey(k('P', 'DIV', { altKey: true, shiftKey: true }), false)).toBe('toggle');
    expect(shouldHandleKey(k('P', 'DIV', { altKey: true, shiftKey: true }), true)).toBe('toggle');
    expect(shouldHandleKey(k('p', 'DIV', { altKey: true, shiftKey: true }), false)).toBe('toggle');
    expect(shouldHandleKey(k('P', 'DIV', { shiftKey: true }), false)).toBeNull();
  });

  it('maps navigation keys while active', () => {
    expect(shouldHandleKey(k('ArrowRight'), true)).toBe('next');
    expect(shouldHandleKey(k(' '), true)).toBe('next');
    expect(shouldHandleKey(k('ArrowLeft'), true)).toBe('prev');
    expect(shouldHandleKey(k('Escape'), true)).toBe('exit');
  });

  it('ignores navigation keys while inactive', () => {
    for (const key of ['ArrowRight', ' ', 'ArrowLeft', 'Escape']) expect(shouldHandleKey(k(key), false)).toBeNull();
  });

  it('ignores everything while focus is in an input, textarea or select (Review Focus 2)', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(shouldHandleKey(k(' ', tag), true)).toBeNull();
      expect(shouldHandleKey(k('ArrowRight', tag), true)).toBeNull();
      expect(shouldHandleKey(k('P', tag, { altKey: true, shiftKey: true }), false)).toBeNull();
    }
    expect(shouldHandleKey({ key: ' ', altKey: false, shiftKey: false, target: null }, true)).toBe('next');
  });
});
