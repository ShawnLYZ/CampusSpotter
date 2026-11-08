import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce.ts';

describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('runs once, 300 ms after the last of many calls', () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    for (let i = 0; i < 20; i++) { d(); vi.advanceTimersByTime(5); }   // 20 calls within 100 ms
    vi.advanceTimersByTime(294);   // 5 ms already passed since the last call
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel stops a pending call', () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('can be called again after running or cancelling', () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d(); vi.advanceTimersByTime(300);
    d.cancel(); d(); vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
