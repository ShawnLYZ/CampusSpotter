import { useCallback, useEffect, useMemo, useState } from 'react';
import { compareScenarios } from '@engine/index.ts';
import type { Forecast, InputBundle, LeverSet } from '@engine/index.ts';
import type { ContextRequest } from '../providers/types.ts';
import { useProvider } from '../app/ProviderContext.tsx';
import { useSubscription } from './useSubscription.ts';
import { forecastCache as cache } from './forecastCache.ts';

export { clearForecastCache } from './forecastCache.ts';
const keyOf = (c: ContextRequest) => `${c.date}|${c.disruptionId ?? ''}|${c.reconstructed ? 1 : 0}`;

export interface ForecastState {
  status: 'loading' | 'ready' | 'error';
  bundle?: InputBundle; noAction?: Forecast; withPlan?: Forecast; error?: string;
}

type Loaded = { key: string; version: number; bundle?: InputBundle; error?: string };

export function useForecast(ctx: ContextRequest, levers: LeverSet): ForecastState {
  const provider = useProvider();
  const key = keyOf(ctx);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const invalidate = useCallback(() => { cache.clear(); setVersion((v) => v + 1); }, []);
  useSubscription('disruptions', invalidate);
  useSubscription('baseline', invalidate);

  useEffect(() => {
    if (!ctx.date) return;
    const hit = cache.get(key);
    if (hit) { setLoaded({ key, version, bundle: hit }); return; }
    let cancelled = false;
    provider.getInputBundle(ctx).then(
      (bundle) => { cache.set(key, bundle); if (!cancelled) setLoaded({ key, version, bundle }); },
      (e: unknown) => { if (!cancelled) setLoaded({ key, version, error: e instanceof Error ? e.message : String(e) }); },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key encodes ctx
  }, [provider, key, version]);

  const current = loaded && loaded.key === key && loaded.version === version ? loaded : null;
  const bundle = current?.bundle;

  const scenarios = useMemo(() => {
    if (!bundle) return null;
    try { return compareScenarios(bundle, levers); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  }, [bundle, levers]);

  if (current?.error) return { status: 'error', error: current.error };
  if (!bundle || !scenarios) return { status: 'loading' };
  if ('error' in scenarios) return { status: 'error', bundle, error: scenarios.error };
  return { status: 'ready', bundle, noAction: scenarios.noAction, withPlan: scenarios.withPlan };
}
