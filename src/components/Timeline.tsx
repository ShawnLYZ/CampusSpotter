import { useTimeStore } from '../store/time.ts';
import { usePlayback } from '../hooks/usePlayback.ts';
import { clock12 } from '../lib/format.ts';

const LAST_STEP = 75;
const START_MIN = 7 * 60;
const SPEEDS = [1, 4, 16] as const;
// 7 AM .. 1 AM hourly (steps 0..72); the 2 AM label is pinned to the right edge.
const HOUR_STEPS = Array.from({ length: 19 }, (_, i) => i * 4);

const pct = (s: number) => `${(s / LAST_STEP) * 100}%`;

export function Timeline({ nowStep }: { nowStep: number | null }) {
  usePlayback(); // each page renders exactly one Timeline, so it owns the playback loop
  const { step, playing, speed, setStep, play, pause, setSpeed } = useTimeStore();
  const clockAt = (s: number) => clock12(START_MIN + s * 15);
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => (playing ? pause() : play())}
          className="w-24 rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm font-medium text-text">
          {playing ? 'Pause' : 'Play'}
        </button>
        <div role="group" aria-label="Playback speed" className="flex gap-1">
          {SPEEDS.map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}
              className={`tabular rounded-md border px-3 py-1.5 text-sm ${speed === s ? 'border-verified bg-panel-2 text-text' : 'border-border text-text-2'}`}>
              {s}×
            </button>
          ))}
        </div>
        <span className="tabular ml-auto text-lg font-semibold text-text" aria-hidden="true">{clockAt(step)}</span>
      </div>
      <div className="relative mt-4 px-2">
        <input type="range" min={0} max={LAST_STEP} step={1} value={step}
          onChange={(e) => setStep(Number(e.target.value))}
          aria-label="Time of day" aria-valuetext={clockAt(step)}
          className="h-6 w-full cursor-pointer accent-verified" />
        {nowStep !== null && (
          <div role="img" aria-label={`Now: ${clockAt(nowStep)}`}
            className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-amber" style={{ left: `calc(0.5rem + (100% - 1rem) * ${nowStep / LAST_STEP})` }}>
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-amber">Now</span>
          </div>
        )}
      </div>
      <div className="relative mx-2 mt-1 h-5 text-xs text-text-2" aria-hidden="true">
        {HOUR_STEPS.map((s) => (
          <span key={s} className="tabular absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(s) }}>
            {clockAt(s).replace(':00 ', ' ')}
          </span>
        ))}
        <span className="tabular absolute right-0 translate-x-1/2 whitespace-nowrap">2 AM</span>
      </div>
    </div>
  );
}
