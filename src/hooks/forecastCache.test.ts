import { describe, expect, it } from 'vitest';
import type { InputBundle } from '@engine/index.ts';
import { clearForecastCache, forecastCache } from './forecastCache.ts';

describe('forecastCache', () => {
  it('clear empties it', () => {
    forecastCache.set('a', {} as InputBundle);
    expect(forecastCache.get('a')).toBeDefined();
    clearForecastCache();
    expect(forecastCache.get('a')).toBeUndefined();
    expect(forecastCache.size).toBe(0);
  });
});
