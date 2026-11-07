/**
 * The Replay page autoplays the day view when the nov4 milestone opens, except while the presenter is running:
 * the presenter always drives playback itself with `replay.play`, and autoplaying first would run the clock and then rewind it.
 */
export function shouldAutoplay(isDayView: boolean, ready: boolean, presenterActive: boolean): boolean {
  return isDayView && ready && !presenterActive;
}
