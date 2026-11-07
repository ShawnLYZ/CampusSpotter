import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SceneErrorBoundary } from './SceneErrorBoundary.tsx';

// react-dom/server doesn't run error boundaries, so drive the class lifecycle directly.
describe('SceneErrorBoundary', () => {
  const fallback = createElement('p', null, 'summary');
  const child = createElement('canvas');

  it('renders its children until something throws', () => {
    const b = new SceneErrorBoundary({ fallback, children: child });
    expect(b.render()).toBe(child);
  });

  it('switches to the fallback after an error and logs it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const b = new SceneErrorBoundary({ fallback, children: child });
    b.state = { ...b.state, ...SceneErrorBoundary.getDerivedStateFromError() };
    b.componentDidCatch(new Error('no gl'));
    expect(b.render()).toBe(fallback);
    expect(warn).toHaveBeenCalledWith('3D scene failed; showing the summary instead.', expect.any(Error));
    warn.mockRestore();
  });
});
