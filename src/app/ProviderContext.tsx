import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DataProvider } from '../providers/DataProvider.ts';
import { createDemoProvider } from '../providers/demo/createDemoProvider.ts';
import { clearForecastCache } from '../hooks/forecastCache.ts';
import { useContextStore } from '../store/context.ts';

const Ctx = createContext<DataProvider | null>(null);

function chooseProvider(): DataProvider {
  // P9 adds the Supabase branch here (VITE_DATA_PROVIDER === 'supabase').
  return createDemoProvider();
}

export function ProviderRoot({ children }: { children: ReactNode }) {
  const provider = useMemo(chooseProvider, []);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void provider.getToday().then((t) => {
      if (cancelled) return;
      if (!useContextStore.getState().ctx.date) useContextStore.getState().setDate(t.date);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [provider]);
  useEffect(() => {
    const offs = (['disruptions', 'baseline'] as const).map((c) => provider.subscribe(c, clearForecastCache));
    return () => offs.forEach((off) => off());
  }, [provider]);
  return (
    <Ctx.Provider value={provider}>
      {ready ? children : <p className="p-6 text-text-2">Loading CampusSpotter…</p>}
    </Ctx.Provider>
  );
}

export function useProvider(): DataProvider {
  const p = useContext(Ctx);
  if (!p) throw new Error('useProvider must be used inside <ProviderRoot>');
  return p;
}
