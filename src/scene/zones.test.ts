import { describe, expect, it } from 'vitest';
import { METRIC_IDS } from '@engine/types.ts';
import { runForecast } from '@engine/forecast.ts';
import { btsWeekend12Dec, concert4Nov, normalWednesday } from '@fixtures/engine/index.ts';
import type { Forecast, StepValue } from '@engine/output.ts';
import { REPLAY_PLAN_4NOV } from '@plans/replayPlan.ts';
import { ZONES, zonePressure } from './zones.ts';
import type { Zone } from './zones.ts';
import { itemById } from './layout.ts';

const zone = (id: string) => ZONES.find((z) => z.id === id)!;

describe('ZONES', () => {
  it('has unique ids', () => {
    const ids = ZONES.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('covers every metric in at least one zone', () => {
    const used = new Set(ZONES.flatMap((z) => z.metrics.map((m) => m.metric)));
    for (const m of METRIC_IDS) expect(used.has(m)).toBe(true);
  });
  it('anchors every block zone inside its layout footprint', () => {
    for (const id of ['block-a', 'block-b', 'block-c', 'block-d', 'block-e']) {
      const it = itemById(id)!;
      const [ax, , az] = zone(id).anchor;
      expect(Math.abs(ax - it.x)).toBeLessThanOrEqual(it.w! / 2);
      expect(Math.abs(az - it.z)).toBeLessThanOrEqual(it.d! / 2);
    }
  });
});

describe('zonePressure', () => {
  it('is red at the APU stop on 4 Nov 18:00', async () => {
    const f = runForecast(await concert4Nov(), []);
    expect(zonePressure(zone('apu-stop'), f, 44).pressure).toBe('red');
  });
  it('is green at the APU stop on 4 Nov 18:00 with the replay plan (coloured by queue, not round trip)', async () => {
    const f = runForecast(await concert4Nov(), REPLAY_PLAN_4NOV);
    const r = zonePressure(zone('apu-stop'), f, 44);
    expect(r.pressure).toBe('green');
    expect(r.worst).toEqual({ metric: 'apuStopQueue', scope: 'campus' });
  });
  it('keeps shuttle round trip in the APU stop details', () => {
    expect(zone('apu-stop').metrics.map((m) => m.metric)).toContain('shuttleRtt');
  });
  it('is ok/green for block A on a normal Wednesday at step 0 via the perBlock lookup', async () => {
    const f = runForecast(await normalWednesday(), []);
    const r = zonePressure(zone('block-a'), f, 0);
    expect(r.status).toBe('ok');
    expect(r.pressure).toBe('green');
    expect(r.worst).not.toBeNull();
  });
  it('resolves the Spine (scope S + walkwayTraffic) and Library (scope L) to ok with a pressure', async () => {
    const f = runForecast(await normalWednesday(), []);
    for (const id of ['spine', 'library']) {
      const r = zonePressure(zone(id), f, 20);
      expect(r.status).toBe('ok');
      expect(r.pressure).not.toBeNull();
      expect(r.worst).not.toBeNull();
    }
  });
  it('is no_service with null pressure at the APU stop on BTS 12 Dec step 30', async () => {
    const f = runForecast(await btsWeekend12Dec(), []);
    const r = zonePressure(zone('apu-stop'), f, 30);
    expect(r.status).toBe('no_service');
    expect(r.pressure).toBeNull();
  });
  it('returns an ok null result for zones without metrics', async () => {
    const f = runForecast(await normalWednesday(), []);
    expect(zonePressure(zone('stadium'), f, 0)).toEqual({ pressure: null, status: 'ok', worst: null });
  });

  describe('synthetic forecasts', () => {
    const sv = (status: StepValue['status'], pressure: StepValue['pressure']): StepValue =>
      ({ value: status === 'ok' ? 1 : null, status, pressure, provenance: null });
    const make = async (apu: StepValue, rtt: StepValue): Promise<Forecast> => {
      const f = structuredClone(runForecast(await normalWednesday(), []));
      f.metrics.apuStopQueue.steps[5] = apu;
      f.metrics.shuttleRtt.steps[5] = rtt;
      return f;
    };
    // A two-metric zone, so the aggregation rules are tested independently of the registry.
    const stop = (): Zone => ({ ...zone('apu-stop'), metrics: [
      { metric: 'apuStopQueue', scope: 'campus' }, { metric: 'shuttleRtt', scope: 'campus' }] });

    it('colours the real APU stop by its queue only', async () => {
      const r = zonePressure(zone('apu-stop'), await make(sv('ok', 'green'), sv('ok', 'red')), 5);
      expect(r).toEqual({ pressure: 'green', status: 'ok', worst: { metric: 'apuStopQueue', scope: 'campus' } });
    });

    it('takes the worst of two metrics and reports it', async () => {
      const r = zonePressure(stop(), await make(sv('ok', 'amber'), sv('ok', 'red')), 5);
      expect(r).toEqual({ pressure: 'red', status: 'ok', worst: { metric: 'shuttleRtt', scope: 'campus' } });
    });
    it('is no_service when every metric is no_service', async () => {
      const r = zonePressure(stop(), await make(sv('no_service', null), sv('no_service', null)), 5);
      expect(r).toEqual({ pressure: null, status: 'no_service', worst: null });
    });
    it('is not_enough_data for not_enough_data + no_service', async () => {
      const r = zonePressure(stop(), await make(sv('not_enough_data', null), sv('no_service', null)), 5);
      expect(r.status).toBe('not_enough_data');
      expect(r.pressure).toBeNull();
    });
    it('ignores no_service next to an ok green metric', async () => {
      const r = zonePressure(stop(), await make(sv('no_service', null), sv('ok', 'green')), 5);
      expect(r).toEqual({ pressure: 'green', status: 'ok', worst: { metric: 'shuttleRtt', scope: 'campus' } });
    });
  });
});
