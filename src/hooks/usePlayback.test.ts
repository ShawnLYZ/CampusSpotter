import { beforeEach, describe, expect, it } from 'vitest';
import { useTimeStore } from '../store/time.ts';
import { createPlaybackClock, fracAt, playbackFrac } from './usePlayback.ts';

describe('playback clock', () => {
  beforeEach(() => {
    useTimeStore.setState({ step: 10, playing: true, speed: 1, range: null });
    playbackFrac.current = 0; playbackFrac.step = -1;
  });

  it('advances whole steps and pairs the fraction with the step', () => {
    const clock = createPlaybackClock(0);
    clock.tick(1500);
    expect(useTimeStore.getState().step).toBe(11);
    expect(fracAt(11)).toBeCloseTo(0.5);
    expect(fracAt(10)).toBe(0);
  });

  it('keeps the fraction on pause so buses freeze in place (R10 revised)', () => {
    const clock = createPlaybackClock(0);
    clock.tick(400);
    useTimeStore.getState().pause();
    expect(clock.tick(400)).toBe(false); // the loop stops; nothing resets the fraction
    expect(playbackFrac).toEqual({ current: expect.closeTo(0.4) as number, step: 10 });
    expect(fracAt(10)).toBeCloseTo(0.4);
  });

  it('a manual step change while paused reads 0 through the step pairing (R15)', () => {
    createPlaybackClock(0).tick(400);
    useTimeStore.getState().pause();
    useTimeStore.getState().setStep(30);
    expect(fracAt(30)).toBe(0);
  });

  it('resumes from the kept fraction instead of jumping back', () => {
    createPlaybackClock(0).tick(400);
    useTimeStore.getState().pause();
    useTimeStore.getState().play();
    const clock = createPlaybackClock(1000);
    clock.tick(1100);
    expect(fracAt(10)).toBeCloseTo(0.5);
  });

  it('a manual step change while playing restarts the fraction', () => {
    const clock = createPlaybackClock(0);
    clock.tick(400);
    useTimeStore.getState().setStep(20);
    clock.tick(600);
    expect(useTimeStore.getState().step).toBe(20);
    expect(fracAt(20)).toBeCloseTo(0.2);
  });
});
