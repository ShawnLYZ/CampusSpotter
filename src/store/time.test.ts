import { beforeEach, describe, expect, it } from 'vitest';
import { useTimeStore } from './time.ts';

describe('time store', () => {
  beforeEach(() => useTimeStore.setState({ step: 0, playing: false, speed: 1, range: null }));

  it('stops at step 75 instead of wrapping (Review Focus 4)', () => {
    useTimeStore.setState({ step: 70, playing: true });
    useTimeStore.getState().advance(10);
    expect(useTimeStore.getState().step).toBe(75);
    expect(useTimeStore.getState().playing).toBe(false);
  });

  it('clamps to the range end and pauses', () => {
    const s = useTimeStore.getState();
    s.setRange({ from: 20, to: 45 });
    useTimeStore.setState({ step: 44, playing: true });
    s.advance(3);
    expect(useTimeStore.getState().step).toBe(45);
    expect(useTimeStore.getState().playing).toBe(false);
  });

  it('keeps playing while inside the range', () => {
    useTimeStore.setState({ step: 10, playing: true });
    useTimeStore.getState().advance(2);
    expect(useTimeStore.getState().step).toBe(12);
    expect(useTimeStore.getState().playing).toBe(true);
  });

  it('restarts from the start when Play is pressed at the end', () => {
    useTimeStore.setState({ step: 75, playing: false, range: null });
    useTimeStore.getState().play();
    expect(useTimeStore.getState().step).toBe(0);
    expect(useTimeStore.getState().playing).toBe(true);
    useTimeStore.getState().setRange({ from: 20, to: 45 });
    useTimeStore.setState({ step: 45, playing: false });
    useTimeStore.getState().play();
    expect(useTimeStore.getState().step).toBe(20);
  });

  it('stores speed', () => {
    useTimeStore.getState().setSpeed(16);
    expect(useTimeStore.getState().speed).toBe(16);
  });
});
