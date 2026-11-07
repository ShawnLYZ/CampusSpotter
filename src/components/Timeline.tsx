import { Pause, Play } from 'lucide-react';
import type { Pressure } from '@engine/index.ts';
import { useTimeStore } from '../store/time.ts';
import { usePlayback } from '../hooks/usePlayback.ts';
import { clock12 } from '../lib/format.ts';

const LAST_STEP = 75;
const START_MIN = 7 * 60;
const SPEEDS = [1, 4, 16] as const;
// 7 AM .. 1 AM hourly (steps 0..72); the 2 AM label is pinned to the right edge.
const HOUR_STEPS = Array.from({ length: 19 }, (_, i) => i * 4);
const STRIP: Record<Pressure, string> = { green: 'var(--color-green)', amber: 'var(--color-amber)', red: 'var(--color-red)' };

const pct = (s: number) => `${(s / LAST_STEP) * 100}%`;

/** Hour labels thin out as the timeline narrows: every hour, every 2 hours, then every 3 hours. */
function labelClass(i: number): string {
  if (i % 6 === 0) return '';
  if (i % 2 === 0) return 'hidden @2xl:inline';
  if (i % 3 === 0) return 'hidden @5xl:inline @max-2xl:inline';
  return 'hidden @5xl:inline';
}

/**
 * Shared day slider with play controls.
 * `pressures`: optional worst pressure per step; drawn as a strip under the slider so busy hours are visible before playing.
 */
export function Timeline({ nowStep, pressures }: { nowStep: number | null; pressures?: (Pressure | null)[] }) {
  usePlayback(); // each page renders exactly one Timeline, so it owns the playback loop
  const { step, playing, speed, setStep, play, pause, setSpeed } = useTimeStore();
  const clockAt = (s: number) => clock12(START_MIN + s * 15);
  const strip = pressures && pressures.length > 0
    ? `linear-gradient(to right, ${pressures.map((p, i) => {
      const c = p ? STRIP[p] : 'var(--color-border)';
      return `${c} ${(i / pressures.length) * 100}% ${((i + 1) / pressures.length) * 100}%`;
    }).join(', ')})`
    : null;
  return (
    <div className="@container card px-4 py-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => (playing ? pause() : play())} className="btn btn-primary w-28"
          aria-label={playing ? 'Pause the day' : 'Play the day'}>
          {playing ? <Pause aria-hidden="true" fill="currentColor" /> : <Play aria-hidden="true" fill="currentColor" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <div role="group" aria-label="Playback speed" className="flex rounded-lg border border-border-strong p-0.5">
          {SPEEDS.map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}
              className={`tabular rounded-md px-2.5 py-1 text-sm transition-colors ${speed === s ? 'bg-panel-3 font-semibold text-text' : 'text-text-2 hover:text-text'}`}>
              {s}×
            </button>
          ))}
        </div>
        <span className="hidden text-xs text-text-3 @3xl:inline">Drag the slider to move through the day</span>
        <span className="ml-auto flex items-baseline gap-2" aria-hidden="true">
          <span className="text-xs text-text-3">Showing</span>
          <span className="tabular text-xl font-semibold text-text">{clockAt(step)}</span>
        </span>
      </div>
      <div className="relative mt-3 px-2">
        <input type="range" min={0} max={LAST_STEP} step={1} value={step}
          onChange={(e) => setStep(Number(e.target.value))}
          aria-label="Time of day" aria-valuetext={clockAt(step)}
          className="h-6 w-full cursor-pointer" />
        {nowStep !== null && (
          <div role="img" aria-label={`Now: ${clockAt(nowStep)}`}
            className="pointer-events-none absolute bottom-0 top-0 w-0.5 rounded bg-amber" style={{ left: `calc(0.5rem + (100% - 1rem) * ${nowStep / LAST_STEP})` }}>
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-amber px-1 text-[10px] font-bold leading-4 text-[#1c1200]">NOW</span>
          </div>
        )}
      </div>
      {strip && (
        <div className="mx-2 mt-1" title="Busiest status across all metrics through the day">
          <div className="h-1.5 rounded-full opacity-80" style={{ background: strip }} aria-hidden="true" />
          <span className="sr-only">The coloured strip shows when the day is normal, busy or overloaded.</span>
        </div>
      )}
      <div className="relative mx-2 mt-1.5 h-4 text-xs text-text-3" aria-hidden="true">
        {HOUR_STEPS.map((s, i) => (
          <span key={s} className={`tabular absolute -translate-x-1/2 whitespace-nowrap ${labelClass(i)}`} style={{ left: pct(s) }}>
            {clockAt(s).replace(':00 ', ' ')}
          </span>
        ))}
        <span className="tabular absolute left-full hidden -translate-x-1/2 whitespace-nowrap @5xl:inline">2 AM</span>
      </div>
    </div>
  );
}
