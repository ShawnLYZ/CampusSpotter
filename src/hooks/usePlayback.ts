import { useEffect } from 'react';
import { useTimeStore } from '../store/time.ts';

/**
 * Fraction (0..1) of step `step` elapsed while playing, paired with the step it belongs to. Kept on pause so the
 * scene freezes where it is; a manual step change makes the pair stale, so `fracAt` reads 0. Read in `useFrame`,
 * never in React state.
 */
export const playbackFrac = { current: 0, step: -1 };

/** The playback fraction for `step`, or 0 when the stored fraction belongs to another step. */
export function fracAt(step: number): number {
  return playbackFrac.step === step ? playbackFrac.current : 0;
}

/**
 * The playback clock behind `usePlayback`: `tick(now)` advances the time store (1x = 1 step per second) and
 * updates `playbackFrac`; it returns whether to keep ticking. A clock started on the step the fraction belongs to
 * resumes from it, so pause/play doesn't jump the buses back.
 */
export function createPlaybackClock(start: number) {
  let last = start;
  let expected = useTimeStore.getState().step;
  let carry = fracAt(expected);
  return {
    tick(now: number): boolean {
      const { speed, advance, step: seen } = useTimeStore.getState();
      if (seen !== expected) carry = 0; // manual step change
      carry += ((now - last) / 1000) * speed;
      last = now;
      const whole = Math.floor(carry);
      if (whole > 0) { carry -= whole; advance(whole); }
      expected = useTimeStore.getState().step;
      playbackFrac.current = carry; playbackFrac.step = expected;
      return useTimeStore.getState().playing;
    },
  };
}

/** rAF loop: 1x = 1 step per second, 4x = 4, 16x = 16. Mount once on the page that shows the timeline. */
export function usePlayback(): void {
  const playing = useTimeStore((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    const clock = createPlaybackClock(performance.now());
    let raf = 0;
    const loop = (now: number) => { if (clock.tick(now)) raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf); // playbackFrac is kept: paused buses stay where they are
  }, [playing]);
}
