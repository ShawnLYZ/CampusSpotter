import { describe, expect, it } from 'vitest';
import { runForecast } from '@engine/forecast.ts';
import { btsWeekend12Dec, concert4Nov } from '@fixtures/engine/index.ts';
import type { Forecast } from '@engine/output.ts';
import { busStates, queueFigures, rainDrops, spineParticleCount, stadiumCrowdCount, windowGlow } from './animation.ts';

describe('queueFigures', () => {
  it('shows one figure per person up to 200', () => {
    expect(queueFigures(150)).toEqual({ count: 150, perFigure: 1, overflowLabel: null });
  });
  it('caps at 200 figures with a ×N label', () => {
    expect(queueFigures(2500)).toEqual({ count: 192, perFigure: 13, overflowLabel: '×13' });
    expect(queueFigures(100000).count).toBeLessThanOrEqual(200);
    expect(queueFigures(0)).toEqual({ count: 0, perFigure: 1, overflowLabel: null });
  });
});

describe('busStates', () => {
  it('gives 6 buses at 4 Nov step 50 with t finite in [0,1]', async () => {
    const f = runForecast(await concert4Nov(), []);
    const buses = busStates(f, 50, 0.5);
    expect(buses).toHaveLength(6);
    for (const b of buses) { expect(Number.isFinite(b.t)).toBe(true); expect(b.t).toBeGreaterThanOrEqual(0); expect(b.t).toBeLessThanOrEqual(1); }
  });
  it('returns nothing when there is no service', async () => {
    const f = runForecast(await btsWeekend12Dec(), []);
    expect(f.metrics.shuttleRtt.steps[30]!.status).toBe('no_service');
    expect(busStates(f, 30, 0)).toEqual([]);
  });
  it('stays finite for a jammed rtt, a null rtt and a bad frac', async () => {
    const f = runForecast(await concert4Nov(), []);
    const g: Forecast = structuredClone(f);
    for (const rtt of [1e9, 0, -5, NaN, null]) {
      g.metrics.shuttleRtt.steps[50]!.value = rtt as number | null;
      for (const frac of [0, 0.999, 1, NaN]) {
        for (const b of busStates(g, 50, frac)) { expect(Number.isFinite(b.t)).toBe(true); expect(b.t).toBeGreaterThanOrEqual(0); expect(b.t).toBeLessThanOrEqual(1); }
      }
    }
  });
  it('caps at 24 buses', async () => {
    const g: Forecast = structuredClone(runForecast(await concert4Nov(), []));
    g.metrics.shuttleRtt.detail.fleet![50] = 99;
    expect(busStates(g, 50, 0)).toHaveLength(24);
  });
  it('has both directions', async () => {
    const f = runForecast(await concert4Nov(), []);
    const dirs = new Set(busStates(f, 50, 0).map((b) => b.direction));
    expect(dirs.size).toBe(2);
  });
});

describe('busStates phase accumulation', () => {
  const pos = (f: Forecast, step: number, frac: number) => busStates(f, step, frac).map((b) => b.t);
  it('is continuous across a step boundary where rtt changes', async () => {
    const g: Forecast = structuredClone(runForecast(await concert4Nov(), []));
    for (const k of [50, 51]) { g.metrics.shuttleRtt.steps[k]!.status = 'ok'; g.metrics.shuttleRtt.detail.fleet![k] = 6; }
    g.metrics.shuttleRtt.steps[50]!.value = 20;
    g.metrics.shuttleRtt.steps[51]!.value = 60;
    const a = pos(g, 50, 1), b = pos(g, 51, 0);
    expect(a).toHaveLength(6);
    a.forEach((t, i) => expect(t).toBeCloseTo(b[i]!, 4));
  });
  it('moves little per step and stays finite in [0,1] through a jam', async () => {
    const g: Forecast = structuredClone(runForecast(await concert4Nov(), []));
    for (let k = 40; k < 60; k++) { g.metrics.shuttleRtt.steps[k]!.status = 'ok'; g.metrics.shuttleRtt.steps[k]!.value = 5000; g.metrics.shuttleRtt.detail.fleet![k] = 6; }
    let prev = pos(g, 40, 0);
    for (let k = 41; k < 60; k++) {
      const cur = pos(g, k, 0);
      cur.forEach((t, i) => { expect(Number.isFinite(t)).toBe(true); expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThanOrEqual(1); expect(Math.abs(t - prev[i]!)).toBeLessThan(0.02); });
      prev = cur;
    }
  });
  it('returns nothing for a zero fleet', async () => {
    const g: Forecast = structuredClone(runForecast(await concert4Nov(), []));
    g.metrics.shuttleRtt.detail.fleet![50] = 0;
    expect(busStates(g, 50, 0.3)).toEqual([]);
  });
});

describe('counts', () => {
  it('spineParticleCount caps at 400', () => {
    expect(spineParticleCount(1000)).toBe(400);
    expect(spineParticleCount(50)).toBe(100);
    expect(spineParticleCount(-3)).toBe(0);
  });
  it('rainDrops', () => {
    expect(rainDrops(0.2)).toBe(0);
    expect(rainDrops(8)).toBe(1200);
    expect(rainDrops(null)).toBe(0);
    expect(rainDrops(50)).toBe(1500);
  });
  it('windowGlow', () => {
    expect(windowGlow(15, 15)).toBe(0.1);
    expect(windowGlow(60, 15)).toBeCloseTo(1);
    expect(windowGlow(100, 15)).toBe(1);
    expect(windowGlow(5, 15)).toBe(0.1);
    expect(windowGlow(5, 0)).toBe(0.1);
  });
  it('stadiumCrowdCount', () => {
    expect(stadiumCrowdCount(0)).toBe(0);
    expect(stadiumCrowdCount(2500)).toBe(250);
    expect(stadiumCrowdCount(1e6)).toBe(600);
  });
});
