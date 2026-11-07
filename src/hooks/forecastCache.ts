import type { InputBundle } from '@engine/index.ts';

const cache = new Map<string, InputBundle>();

export const forecastCache = {
  get: (key: string): InputBundle | undefined => cache.get(key),
  set: (key: string, bundle: InputBundle): void => { cache.set(key, bundle); },
  clear: (): void => { cache.clear(); },
  get size(): number { return cache.size; },
};

export const clearForecastCache = (): void => forecastCache.clear();
