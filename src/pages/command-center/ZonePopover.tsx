import { useEffect } from 'react';
import type { Forecast, InputBundle } from '@engine/index.ts';
import type { SourceInfo } from '../../providers/types.ts';
import { ZoneDetails, zoneInfo } from '../../scene/ZoneDetails.tsx';

export function ZonePopover({ zoneId, forecast, step, bundle, sources, onClose }: {
  zoneId: string; forecast: Forecast; step: number; bundle: InputBundle; sources?: SourceInfo[]; onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const { name } = zoneInfo(zoneId);
  return (
    <div role="dialog" aria-label={`${name} details`}
      className="absolute right-4 top-4 z-10 max-h-[calc(100%-2rem)] w-80 overflow-y-auto rounded-lg border border-border bg-panel-2 p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">{name}</h2>
        <button type="button" autoFocus onClick={onClose} aria-label="Close zone details"
          className="rounded-md border border-border px-2 py-0.5 text-sm text-text">Close</button>
      </div>
      <div className="mt-3">
        <ZoneDetails zoneId={zoneId} forecast={forecast} step={step} bundle={bundle} sources={sources} />
      </div>
    </div>
  );
}
