import { describe, it, expect, beforeAll } from 'vitest';
import {
  normalWednesday, concert4Nov, friday6Nov, holiday9Nov, btsWeekend12Dec, missingRoadAfter9pm, fridayVariant,
} from './index.ts';
import { makeBundle } from './testkit.ts';
import { fixtureTables } from '../rows/index.ts';
import type { InputBundle, SessionGroup } from '../../engine/types.ts';

describe('named engine fixtures', () => {
  it('normalWednesday', async () => {
    const b = await normalWednesday();
    expect(b.context.dayType).toBe('weekday');
    expect(b.timetable?.label).toBe('verified');
  });
  it('concert4Nov', async () => {
    const b = await concert4Nov();
    expect(b.road.kind).toBe('reconstructed');
    expect(b.context.disruptions.map((d) => d.id)).toContain('weeknd-2026-11-04');
    expect(b.estimates.length).toBeGreaterThanOrEqual(7);
  });
  it('holiday9Nov', async () => {
    const b = await holiday9Nov();
    expect(b.context.dayType).toBe('no_class');
    expect(b.timetable?.groups.length ?? 0).toBe(0);
  });
  it('btsWeekend12Dec', async () => {
    const b = await btsWeekend12Dec();
    expect(b.shuttle.service).toBe('none');
    expect(b.timetable?.label).toBe('baseline');
  });
  it('missingRoadAfter9pm', async () => {
    const b = await missingRoadAfter9pm();
    expect(b.road.ratio[13]).not.toBeNull();
    for (let i = 14; i < 20; i++) expect(b.road.ratio[i]).toBeNull();
  });
  it('fridayVariant friday+rain+event has prayer, rain and event rows', async () => {
    const before = fixtureTables.disruptions.length;
    const b = await fridayVariant('friday+rain+event');
    expect(b.context.disruptions.map((d) => d.id).sort()).toEqual(
      ['friday-prayer-2026-11-06', 'heavy-rain-2026-11-06', 'test-unifi-2026-11-06']);
    expect(b.weather?.precipitationMm[8]?.value).toBe(8);
    expect(b.estimates.length).toBeGreaterThanOrEqual(6);
    expect(fixtureTables.disruptions.length).toBe(before);
  });
  it('fridayVariant friday has exactly the prayer row; friday6Nov has none', async () => {
    expect((await fridayVariant('friday')).context.disruptions.map((d) => d.id)).toEqual(['friday-prayer-2026-11-06']);
    expect((await friday6Nov()).context.disruptions.some((d) => d.id.startsWith('friday-prayer'))).toBe(false);
  });
});

describe('makeBundle', () => {
  let base: InputBundle;
  beforeAll(async () => { base = await normalWednesday(); });
  it('applies options on a deep copy', () => {
    const g: SessionGroup = { block: 'A', roomType: 'classroom', startMin: 540, endMin: 660, count: 3, firstOfDayShare: 1, lastOfDayShare: 0 };
    const b = makeBundle(base, { groups: [g], roadRatio: 2, baseline: { fleetSize: 8 } });
    expect(b.timetable!.groups.length).toBe(1);
    expect(b.road.ratio[5]!.value).toBe(2);
    expect(b.road.ratio[5]!.label).toBe('verified');
    expect(b.baseline.fleetSize.value).toBe(8);
    expect(base.baseline.fleetSize.value).toBe(6);
    expect(base.timetable!.groups.length).toBeGreaterThan(1);
  });
});
