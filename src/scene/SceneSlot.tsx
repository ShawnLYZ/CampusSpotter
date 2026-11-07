import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import type { Forecast } from '@engine/index.ts';
import { clock12, formatMetric } from '../lib/format.ts';
import type { CameraPresetId } from './cameraPresets.ts';
import { hasWebGL } from './webgl.ts';
import { SceneErrorBoundary } from './SceneErrorBoundary.tsx';

export type { CameraPresetId } from './cameraPresets.ts';

export interface SceneSlotProps {
  mode: 'single' | 'split';
  forecasts: Forecast[];
  step: number;
  captions?: string[];
  cameraPreset?: CameraPresetId;
  onZoneClick?: (zoneId: string) => void;
  /** Hourly precipitation (20 points); used by the 3D scene for rain. */
  weatherMm?: (number | null)[];
}

// Loaded on demand so three.js stays out of the main chunk (and never loads without WebGL).
const CampusCanvas = lazy(() => import('./CampusCanvas.tsx').then((m) => ({ default: m.CampusCanvas })));

let webglMemo: boolean | undefined;
/** `hasWebGL()` probed once per page load (it creates a throwaway context). */
const webglSupported = () => (webglMemo ??= hasWebGL());

const NO_WEBGL_MESSAGE = '3D view needs WebGL — showing summary instead';

/** The 3D campus for one forecast (`single`) or two side by side (`split`), in one shared canvas. Falls back to summary panels without WebGL. */
export function SceneSlot({ mode, forecasts, step, captions, cameraPreset, onZoneClick, weatherMm }: SceneSlotProps) {
  const [webgl] = useState(webglSupported);
  const [selected, setSelected] = useState<string | null>(null);
  const shown = mode === 'split' ? forecasts.slice(0, 2) : forecasts.slice(0, 1);

  // Callers pass fresh arrays each render; key the memos on their contents so the scene isn't invalidated needlessly.
  const [f0, f1] = shown;
  const [c0, c1] = [captions?.[0], captions?.[1]];
  const views = useMemo(
    () => [f0, f1].filter((f): f is Forecast => !!f).map((forecast, i) => ({ forecast, caption: i === 0 ? c0 : c1 })),
    [f0, f1, c0, c1],
  );
  const weatherKey = weatherMm?.join(',');
  const weather = useMemo(() => weatherMm, [weatherKey]);

  const zoneClick = useCallback((id: string) => { setSelected(id); onZoneClick?.(id); }, [onZoneClick]);
  const clear = useCallback(() => setSelected(null), []);

  const fallback = (
    <div className="flex h-full flex-col gap-2">
      <p role="status" className="text-sm text-text-2">{NO_WEBGL_MESSAGE}</p>
      <div className="min-h-0 flex-1">
        <PlaceholderPanels mode={mode} forecasts={shown} step={step} captions={captions} onZoneClick={onZoneClick} />
      </div>
    </div>
  );

  return (
    <div data-scene="" className="h-full">
      {webgl ? (
        <SceneErrorBoundary fallback={fallback}>
          <Suspense fallback={<div role="status" aria-label="Loading 3D view" className="h-full min-h-32 card" />}>
            <CampusCanvas views={views} step={step} cameraPreset={cameraPreset} weatherMm={weather}
              selectedZone={selected} onZoneClick={zoneClick} onEmptyClick={clear} />
          </Suspense>
        </SceneErrorBoundary>
      ) : fallback}
    </div>
  );
}

/** The P3 summary panels: APU stop wait per forecast; a click opens the campus details. */
function PlaceholderPanels({ mode, forecasts, step, captions, onZoneClick }: Pick<SceneSlotProps, 'mode' | 'forecasts' | 'step' | 'captions' | 'onZoneClick'>) {
  return (
    <div className={`grid h-full gap-3 ${mode === 'split' ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {forecasts.map((f, i) => {
        const sv = f.metrics.apuStopQueue.steps[step];
        return (
          <div key={i} role="button" tabIndex={0} aria-label="Open campus details"
            onClick={() => onZoneClick?.('campus')}
            onKeyDown={(e) => { if (e.key === 'Enter') onZoneClick?.('campus'); }}
            className="flex h-full min-h-32 cursor-pointer flex-col items-center justify-center card p-4 text-center">
            {captions?.[i] && <p className="mb-2 text-lg font-medium text-text">{captions[i]}</p>}
            <p className="tabular text-text">
              APU stop wait at {clock12(7 * 60 + step * 15)}: {sv ? formatMetric('apuStopQueue', sv) : 'Not enough data'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
