import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasWebGL } from './webgl.ts';

const stubCanvas = (getContext: (kind: string) => unknown) =>
  vi.stubGlobal('document', { createElement: () => ({ getContext }) });

describe('hasWebGL', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('is false without a document (node / SSR)', () => {
    expect(typeof document).toBe('undefined');
    expect(hasWebGL()).toBe(false);
  });

  it('is false when getContext throws', () => {
    stubCanvas(() => { throw new Error('no gl'); });
    expect(hasWebGL()).toBe(false);
  });

  it('is false when neither webgl2 nor webgl gives a context', () => {
    stubCanvas(() => null);
    expect(hasWebGL()).toBe(false);
  });

  it('is true when webgl2 gives a context', () => {
    stubCanvas((kind) => (kind === 'webgl2' ? {} : null));
    expect(hasWebGL()).toBe(true);
  });

  it('falls back to webgl when webgl2 is unavailable', () => {
    const asked: string[] = [];
    stubCanvas((kind) => { asked.push(kind); return kind === 'webgl' ? {} : null; });
    expect(hasWebGL()).toBe(true);
    expect(asked).toEqual(['webgl2', 'webgl']);
  });
});
