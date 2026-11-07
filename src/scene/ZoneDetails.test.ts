import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { METRIC_IDS } from '@engine/index.ts';
import type { Forecast, InputBundle } from '@engine/index.ts';
import { ZoneDetails, zoneInfo } from './ZoneDetails.tsx';

describe('zoneInfo', () => {
  it('returns the scene zone for a known id', () => {
    const z = zoneInfo('block-b');
    expect(z.name).toBe('Block B');
    expect(z.metrics).toEqual([{ metric: 'classroomOccupancy', scope: 'B' }, { metric: 'buildingEnergy', scope: 'B' }]);
  });

  it('falls back to every campus metric for an unknown id (the placeholder panel sends "campus")', () => {
    for (const id of ['campus', 'nope']) {
      const z = zoneInfo(id);
      expect(z.name).toBe('Campus');
      expect(z.metrics).toEqual(METRIC_IDS.map((metric) => ({ metric, scope: 'campus' })));
    }
  });

  it('has no metrics for a selection-only zone', () => {
    expect(zoneInfo('residences').metrics).toEqual([]);
  });
});

describe('ZoneDetails', () => {
  it('says there are no live figures for a zero-metric zone', () => {
    const html = renderToStaticMarkup(createElement(ZoneDetails, {
      zoneId: 'residences', forecast: {} as Forecast, step: 0, bundle: {} as InputBundle,
    }));
    expect(html).toContain('No live figures for this zone.');
    expect(html).not.toContain('<li');
  });
});
