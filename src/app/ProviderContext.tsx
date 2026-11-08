import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DataProvider } from '../providers/DataProvider.ts';
import { createSupabaseProvider } from '../providers/supabase/createSupabaseProvider.ts';
import { createBrowserClient } from '../providers/supabase/client.ts';
import { clearForecastCache } from '../hooks/forecastCache.ts';
import { useContextStore } from '../store/context.ts';

const Ctx = createContext<DataProvider | null>(null);

/** Async so a missing Supabase key surfaces as the start-up failure message below. */
async function startProvider(): Promise<DataProvider> {
  return createSupabaseProvider(createBrowserClient());
}

export function ProviderRoot({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<DataProvider | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    startProvider().then((p) => { if (!cancelled) setProvider(p); }, (e: unknown) => {
      if (!cancelled) setFailure(e instanceof Error ? e.message : 'CampusSpotter could not start.');
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!provider) return;
    let cancelled = false;
    void provider.getToday().then((t) => {
      if (cancelled) return;
      if (!useContextStore.getState().ctx.date) useContextStore.getState().setDate(t.date);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [provider]);
  useEffect(() => {
    if (!provider) return;
    const offs = (['disruptions', 'baseline'] as const).map((c) => provider.subscribe(c, clearForecastCache));
    return () => offs.forEach((off) => off());
  }, [provider]);
  if (failure) return <p role="alert" className="p-6 text-text-2">{failure}</p>;
  if (!provider || !ready) return <p className="p-6 text-text-2">Loading CampusSpotter…</p>;
  return <Ctx.Provider value={provider}>{children}</Ctx.Provider>;
}

export function useProvider(): DataProvider {
  const p = useContext(Ctx);
  if (!p) throw new Error('useProvider must be used inside <ProviderRoot>');
  return p;
}
