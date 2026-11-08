import { useCallback, useEffect, useMemo, useState } from 'react';
import { compareScenarios } from '@engine/index.ts';
import type { Estimate, Forecast, InputBundle, LeverSet } from '@engine/index.ts';
import type { ContextRequest } from '../providers/types.ts';
import { useProvider } from '../app/ProviderContext.tsx';
import { useSubscription } from './useSubscription.ts';
import { forecastCache as cache } from './forecastCache.ts';
import { applyRefresh } from './estimateRefresh.ts';

export { clearForecastCache } from './forecastCache.ts';
const keyOf = (c: ContextRequest) => `${c.date}|${c.disruptionId ?? ''}|${c.reconstructed ? 1 : 0}`;

export interface ForecastState {
  status: 'loading' | 'ready' | 'error';
  bundle?: InputBundle; noAction?: Forecast; withPlan?: Forecast; error?: string;
  estimatesStale?: boolean;   // the Gemini refresh failed over to the saved estimates
}

type Loaded = { key: string; version: number; bundle?: InputBundle; error?: string };

type Refreshed = { key: string; version: number; estimates: Estimate[] | null };

/** `opts.refreshEstimates` asks the provider for fresh AI estimates once per context after the bundle loads; other callers never trigger Gemini. */
export function useForecast(ctx: ContextRequest, levers: LeverSet, opts: { refreshEstimates?: boolean } = {}): ForecastState {
  const provider = useProvider();
  const key = keyOf(ctx);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshed, setRefreshed] = useState<Refreshed | null>(null);
  const refresh = opts.refreshEstimates === true;

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
  const loadedBundle = current?.bundle;
  const hasBundle = loadedBundle !== undefined;

  useEffect(() => {
    if (!refresh || !hasBundle) return;
    let cancelled = false;
    provider.refreshEstimates(ctx).then(
      (estimates) => { if (!cancelled) setRefreshed({ key, version, estimates }); },
      (e: unknown) => {
        console.warn('Couldn’t refresh the AI estimates; using the saved ones', e);
        if (!cancelled) setRefreshed({ key, version, estimates: null });
      },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per context: key encodes ctx, and the result is state, not a dependency
  }, [provider, key, version, refresh, hasBundle]);

  const applied = useMemo(() => {
    if (!loadedBundle) return null;
    const mine = refreshed && refreshed.key === key && refreshed.version === version ? refreshed : null;
    return applyRefresh(loadedBundle, mine?.estimates ?? null);
  }, [loadedBundle, refreshed, key, version]);
  const bundle = applied?.bundle;

  const scenarios = useMemo(() => {
    if (!bundle) return null;
    try { return compareScenarios(bundle, levers); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  }, [bundle, levers]);

  if (current?.error) return { status: 'error', error: current.error };
  if (!bundle || !scenarios) return { status: 'loading' };
  if ('error' in scenarios) return { status: 'error', bundle, error: scenarios.error };
  return { status: 'ready', bundle, noAction: scenarios.noAction, withPlan: scenarios.withPlan, estimatesStale: applied?.estimatesStale };
}
