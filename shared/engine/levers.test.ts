import { describe, it, expect, beforeAll } from 'vitest';
import { LEVER_CATALOGUE, validateLevers } from './levers.ts';
import type { InputBundle, LeverSet } from './types.ts';
import { normalWednesday } from '../fixtures/engine/index.ts';
import { makeBundle } from '../fixtures/engine/testkit.ts';

let b: InputBundle;
beforeAll(async () => { b = await normalWednesday(); });

describe('LEVER_CATALOGUE', () => {
  it('has 10 entries in PRD order', () => {
    expect(LEVER_CATALOGUE.map(l => l.kind)).toEqual(['classesOnline', 'stagger', 'extraBuses', 'nonstopLoop',
      'busesAtLrt', 'cafeteria', 'waitingHall', 'acOffInGap', 'advisory', 'studentCount']);
    expect(LEVER_CATALOGUE.find(l => l.kind === 'extraBuses')!.team).toBe('transport');
    expect(LEVER_CATALOGUE.find(l => l.kind === 'advisory')!.team).toBe('academic');
    expect(LEVER_CATALOGUE.find(l => l.kind === 'studentCount')!.team).toBe('whatif');
  });
});

describe('validateLevers', () => {
  it('clamps window and shifts with two adjusted warnings', () => {
    const r = validateLevers([{ kind: 'stagger', target: 'end', fromMin: 300, toMin: 700, shifts: { B: 45 } }], b);
    const l = r.levers[0] as Extract<LeverSet[number], { kind: 'stagger' }>;
    expect([l.fromMin, l.toMin]).toEqual([420, 700]);
    expect(l.shifts.B).toBe(30);
    expect(r.warnings.filter(w => w.code === 'lever_adjusted')).toHaveLength(2);
    expect(r.warnings.every(w => w.message.includes('stagger'))).toBe(true);
  });
  it('drops empty windows', () => {
    const r = validateLevers([{ kind: 'extraBuses', buses: 2, fromMin: 900, toMin: 900 }], b);
    expect(r.levers).toEqual([]);
    expect(r.warnings.map(w => w.code)).toEqual(['lever_dropped']);
  });
  it('keeps only the last studentCount and clamps percent', () => {
    const r = validateLevers([{ kind: 'studentCount', percent: 10 }, { kind: 'studentCount', percent: 80 }], b);
    expect(r.levers).toEqual([{ kind: 'studentCount', percent: 50 }]);
  });
  it('drops unknown outlet and hall', () => {
    const r = validateLevers([
      { kind: 'cafeteria', outletId: 'nope', extraCounters: 1, fromMin: 700, toMin: 800, closeAtMin: null },
      { kind: 'waitingHall', hallId: 'nope', fromMin: 700, toMin: 800 }], b);
    expect(r.levers).toEqual([]);
    expect(r.warnings.filter(w => w.code === 'lever_dropped')).toHaveLength(2);
  });
  it('keeps known outlet and hall', () => {
    const r = validateLevers([
      { kind: 'cafeteria', outletId: b.baseline.cafeterias[0].id, extraCounters: 1, fromMin: 700, toMin: 800, closeAtMin: null },
      { kind: 'waitingHall', hallId: b.baseline.waitingHalls[0].id, fromMin: 700, toMin: 800 }], b);
    expect(r.levers).toHaveLength(2);
    expect(r.warnings).toEqual([]);
  });
  it('rounds and clamps bus counts', () => {
    const fleet = b.baseline.fleetSize.value;
    const r = validateLevers([
      { kind: 'extraBuses', buses: 15.4, fromMin: 600, toMin: 700 },
      { kind: 'busesAtLrt', buses: fleet + 5, atMin: 300 }], b);
    expect((r.levers[0] as { buses: number }).buses).toBe(10);
    expect(r.levers[1]).toEqual({ kind: 'busesAtLrt', buses: fleet, atMin: 420 });
    expect(r.warnings.filter(w => w.code === 'lever_adjusted' && w.message.includes('adjusted from'))).toHaveLength(3);
    // 7:00 AM is before the first LRT-end service (7:30 AM loop): F4 service-hours warning.
    expect(r.warnings.filter(w => w.code === 'lever_adjusted')).toHaveLength(4);
  });
  it('clamps advisory time and does not mutate input', () => {
    const input: LeverSet = [{ kind: 'advisory', advisedMin: 1700, message: 'expect_delays' }];
    const r = validateLevers(input, b);
    expect((r.levers[0] as { advisedMin: number }).advisedMin).toBe(1560);
    expect((input[0] as { advisedMin: number }).advisedMin).toBe(1700);
  });

  // normalWednesday: last APU→LRT departure 9:45 PM (1305); LRT→APU service 7:30 AM loop – 6:20 PM (1100).
  describe('F4: shuttle levers outside service hours', () => {
    const adjusted = (r: ReturnType<typeof validateLevers>) => r.warnings.filter(w => w.code === 'lever_adjusted');
    it('nonstopLoop beyond the last departure warns, values unchanged', () => {
      const r = validateLevers([{ kind: 'nonstopLoop', fromMin: 1290, toMin: 1380 }], b);
      expect(r.levers).toEqual([{ kind: 'nonstopLoop', fromMin: 1290, toMin: 1380 }]);
      expect(adjusted(r).map(w => w.message)).toEqual(['nonstopLoop: 9:30 PM–11:00 PM outside shuttle service hours, no effect after 9:45 PM']);
    });
    it('extraBuses beyond the last departure warns, values unchanged', () => {
      const r = validateLevers([{ kind: 'extraBuses', buses: 2, fromMin: 1200, toMin: 1440 }], b);
      expect((r.levers[0] as { toMin: number }).toMin).toBe(1440);
      expect(adjusted(r).map(w => w.message)).toEqual(['extraBuses: 8:00 PM–12:00 AM outside shuttle service hours, no effect after 9:45 PM']);
    });
    it('windows inside service (up to the end of the last departure step) do not warn', () => {
      const r = validateLevers([
        { kind: 'nonstopLoop', fromMin: 1260, toMin: 1320 },
        { kind: 'extraBuses', buses: 1, fromMin: 600, toMin: 1080 },
        { kind: 'busesAtLrt', buses: 2, atMin: 720 }], b);
      expect(r.warnings).toEqual([]);
    });
    it("a day with service 'none' warns for every shuttle lever", () => {
      const none = makeBundle(b, { shuttle: { service: 'none' } });
      const r = validateLevers([
        { kind: 'nonstopLoop', fromMin: 600, toMin: 720 },
        { kind: 'extraBuses', buses: 1, fromMin: 600, toMin: 720 },
        { kind: 'busesAtLrt', buses: 1, atMin: 720 }], none);
      expect(r.levers).toHaveLength(3);
      expect(adjusted(r).map(w => w.message)).toEqual([
        'nonstopLoop: outside shuttle service hours, no shuttle service on this day',
        'extraBuses: outside shuttle service hours, no shuttle service on this day',
        'busesAtLrt: outside shuttle service hours, no shuttle service on this day',
      ]);
    });
    it('busesAtLrt outside LRT service warns, values unchanged', () => {
      const r = validateLevers([{ kind: 'busesAtLrt', buses: 2, atMin: 1200 }, { kind: 'busesAtLrt', buses: 2, atMin: 420 }], b);
      expect(r.levers.map(l => (l as { atMin: number }).atMin)).toEqual([1200, 420]);
      expect(adjusted(r).map(w => w.message)).toEqual([
        'busesAtLrt: 8:00 PM outside shuttle service hours, no effect after 6:20 PM',
        'busesAtLrt: 7:00 AM outside shuttle service hours, no effect before 7:30 AM',
      ]);
    });
  });

  it('M2: clamps cafeteria closeAtMin into [420, toMin]', () => {
    const id = b.baseline.cafeterias[0].id;
    const r = validateLevers([
      { kind: 'cafeteria', outletId: id, extraCounters: 0, fromMin: 1080, toMin: 1200, closeAtMin: 1320 },
      { kind: 'cafeteria', outletId: id, extraCounters: 0, fromMin: 1080, toMin: 1320, closeAtMin: 1320 },
      { kind: 'cafeteria', outletId: id, extraCounters: 1, fromMin: 700, toMin: 800, closeAtMin: null }], b);
    expect(r.levers.map(l => (l as { closeAtMin: number | null }).closeAtMin)).toEqual([1200, 1320, null]);
    expect(r.warnings).toEqual([{ code: 'lever_adjusted', message: 'cafeteria: closeAtMin adjusted from 1320 to 1200' }]);
  });

  it('M3: a cafeteria lever on a non-modelled outlet is kept with a cost-only warning', () => {
    const two = structuredClone(b);
    two.baseline.cafeterias.push({ ...structuredClone(b.baseline.cafeterias[0]), id: 'kiosk', name: 'Kiosk' });
    const r = validateLevers([{ kind: 'cafeteria', outletId: 'kiosk', extraCounters: 1, fromMin: 700, toMin: 800, closeAtMin: null }], two);
    expect(r.levers).toHaveLength(1);
    expect(r.warnings).toEqual([{ code: 'lever_adjusted', message: 'Kiosk: not modelled; cost only' }]);
  });
});
