import { describe, expect, it } from 'vitest';
import type { Forecast, Label } from '@engine/index.ts';
import { figureProvenance } from './figureProvenance.ts';

const series = (labels: (Label | null)[], inputs: string[]) => ({
  steps: labels.map((provenance) => ({ value: 1, status: 'ok', pressure: null, provenance })), inputs,
});
const forecast = {
  metrics: {
    apuStopQueue: series(['baseline', 'ai', null], ['estimate:a:d', 'shuttle']),
    lrtStopQueue: series(['verified', 'baseline'], ['ridership', 'shuttle']),
    buildingEnergy: series([null, null], []),
  },
} as unknown as Forecast;

describe('figureProvenance', () => {
  it('takes the weakest non-null label and merges inputs without duplicates', () => {
    expect(figureProvenance(forecast, ['apuStopQueue', 'lrtStopQueue'])).toEqual({
      label: 'ai', inputs: ['estimate:a:d', 'shuttle', 'ridership'],
    });
  });
  it('reads only the requested metrics', () => {
    expect(figureProvenance(forecast, ['lrtStopQueue'])).toEqual({ label: 'baseline', inputs: ['ridership', 'shuttle'] });
  });
  it('takes the weakest label and merged inputs over several forecasts', () => {
    const other = { metrics: { lrtStopQueue: series(['ai'], ['estimate:b:d']), apuStopQueue: series(['verified'], []) } } as unknown as Forecast;
    expect(figureProvenance([forecast, other], ['lrtStopQueue'])).toEqual({ label: 'ai', inputs: ['ridership', 'shuttle', 'estimate:b:d'] });
    expect(figureProvenance([other, forecast], ['apuStopQueue']).label).toBe('ai');
  });
  it('gives a null label when every step is null', () => {
    expect(figureProvenance(forecast, ['buildingEnergy'])).toEqual({ label: null, inputs: [] });
  });
});
