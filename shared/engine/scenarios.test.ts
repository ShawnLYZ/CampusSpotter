import { describe, it, expect } from 'vitest';
import { runForecast } from './forecast.ts';
import { METRIC_IDS, PRIMARY_METRICS } from './types.ts';
import { stepOf } from './grid.ts';
import { btsWeekend12Dec, friday6Nov, fridayVariant, holiday9Nov, normalWednesday } from '../fixtures/engine/index.ts';

const rank = { low: 0, medium: 1, high: 2, critical: 3 } as const;

describe('scenarios on real fixtures', () => {
// D22, relaxed by the product owner (D28): the 1:00 pm class change pushes the Spine walkway
// past capacity on a normal day, so the walkway may go red for up to 30 minutes and the day
// may rate High. Every other primary metric must stay out of red, and the day is never Critical.
it('normal Wednesday stays mostly green (D22, relaxed for the walkway by D28)', async () => {
  const f = runForecast(await normalWednesday(), []);
  for (const m of PRIMARY_METRICS) {
    if (m === 'walkwayTraffic') expect(f.summary.redMinutes[m], m).toBeLessThanOrEqual(30);
    else expect(f.summary.redMinutes[m], m).toBe(0);
  }
  const steps = METRIC_IDS.flatMap(m => f.metrics[m].steps.filter(s => s.pressure !== null));
  expect(steps.filter(s => s.pressure === 'green').length / steps.length).toBeGreaterThanOrEqual(0.8);
  expect(['low', 'medium', 'high']).toContain(f.risk!.level);
});
it('Friday shows the afternoon-restart walkway peak (D27: 2:00–2:45 pm) and a split lunch', async () => {
  const f = runForecast(await friday6Nov(), []);
  expect(f.summary.peaks.walkwayTraffic.atMin!).toBeGreaterThanOrEqual(840);
  expect(f.summary.peaks.walkwayTraffic.atMin!).toBeLessThanOrEqual(885);
  const a = f.metrics.cafeteriaQueue.detail.arrivals;
  const peak1 = Math.max(...a.slice(stepOf(720), stepOf(795))), peak2 = Math.max(...a.slice(stepOf(840), stepOf(885) + 1));
  const dip = (a[stepOf(810)] + a[stepOf(825)]) / 2;
  expect(peak1).toBeGreaterThan(0); expect(peak2).toBeGreaterThan(0); expect(dip).toBeLessThan(0.5 * Math.min(peak1, peak2));
});
it('BTS weekend is Medium with the weekend reason', async () => {
  const f = runForecast(await btsWeekend12Dec(), []);
  expect(f.risk!.level).toBe('medium'); expect(f.risk!.reason.startsWith('Weekend (no shuttle,')).toBe(true);
});
it('Deepavali holiday is Low because there are no classes', async () => {
  const f = runForecast(await holiday9Nov(), []);
  expect(f.risk!.level).toBe('low'); expect(f.risk!.reason).toBe('No classes today');
});
it('an event on a rainy Friday is rated at least as high as each part', async () => {
  const r = async (v: Parameters<typeof fridayVariant>[0]) => rank[runForecast(await fridayVariant(v), []).risk!.level];
  const all = await r('friday+rain+event');
  expect(all).toBeGreaterThanOrEqual(Math.max(await r('friday'), await r('friday+rain'), await r('friday+event')));
});
});
