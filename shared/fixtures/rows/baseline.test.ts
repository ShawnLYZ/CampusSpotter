import { describe, it, expect } from 'vitest';
import { fixtureTables } from './index.ts';
import type { BaselineValueRow, SettingsRow, CafeteriaOutletRow, EnergyProfileRow, WaitingHallRow } from '../../bundle/rows.ts';

const bv = fixtureTables.baseline_values as BaselineValueRow[];
const val = (k: string) => bv.find((r) => r.key === k)?.value;

describe('baseline fixtures', () => {
  it('has the expected baseline values', () => {
    const expected: Record<string, unknown> = {
      population: 12000, resident_share: 0.15, shuttle_share: 0.35, attendees_per_session: 30, attendance_rate: 0.85,
      leave_spread_min: 30, arrive_spread_min: 45, free_flow_one_way_min: 6, loading_min_per_terminal: 3,
      fleet_size: 6, bus_seats: 44, give_up_wait_min: 60, give_up_rate_per_hour: 0.2, default_stay_share: 0.3,
      stop_outdoor_capacity: 150, kept_open_block: 'B', rain_factor: 1.25, rain_threshold_mm_per_h: 5,
      eat_on_campus_share: 0.5, lunch_spread_min: 90, walkway_capacity_per_min: 150, friday_prayer_share: 0.3,
      seats_classroom: 40, seats_lab: 30, seats_auditorium: 150,
    };
    for (const [k, v] of Object.entries(expected)) expect(val(k), k).toEqual(v);
  });
  it('has a 20-point LRT hourly profile', () => {
    const p = val('lrt_hourly_profile') as number[];
    expect(p).toHaveLength(20);
    const s = p.reduce((a, b) => a + b, 0);
    expect(s).toBeGreaterThanOrEqual(0.95);
    expect(s).toBeLessThanOrEqual(1.0);
  });
  it('labels every row', () => {
    for (const t of ['baseline_values', 'cafeteria_outlets', 'energy_profiles', 'waiting_halls', 'sources'] as const)
      for (const r of fixtureTables[t] as { label: string }[]) expect(['verified', 'baseline', 'ai']).toContain(r.label);
  });
  it('has settings', () => {
    const v = (fixtureTables.settings as SettingsRow[])[0].value;
    expect(v.defaultBudgetRm.value).toBe(2000);
    expect(v.busOneWayRm.value).toBe(400);
    expect(v.busHalfDayRm.value).toBe(650);
    expect(v.busFullDayRm.value).toBe(950);
    expect(v.staffRatePerHourRm.value).toBe(10);
    expect(v.staffPerCounter.value).toBe(2);
    expect(v.tariffPeakSenPerKwh.value).toBe(31.32);
    expect(v.tariffOffPeakSenPerKwh.value).toBe(27.23);
    expect(v.peakFromMin).toBe(840);
    expect(v.peakToMin).toBe(1320);
    expect(v.thresholds).toEqual({
      classroomOccupancy: { amberFrom: 85, redAbove: 100, greenInclusive: false },
      cafeteriaQueue: { amberFrom: 10, redAbove: 20, greenInclusive: false },
      buildingEnergy: { amberFrom: 10, redAbove: 25, greenInclusive: true },
      walkwayTraffic: { amberFrom: 70, redAbove: 100, greenInclusive: false },
      apuStopQueue: { amberFrom: 15, redAbove: 45, greenInclusive: false },
      lrtStopQueue: { amberFrom: 15, redAbove: 45, greenInclusive: false },
      shuttleRtt: { amberFrom: 25, redAbove: 45, greenInclusive: false },
      roadDelay: { amberFrom: 1.3, redAbove: 2, greenInclusive: false },
      lrtCrowding: { amberFrom: 1.5, redAbove: 3, greenInclusive: false },
    });
    expect(v.risk).toEqual({ criticalRedMin: 120, criticalApuWaitMin: 90, criticalLeftBehind: 100, highRedMin: 30, mediumAmberMin: 60 });
  });
  it('has cafeteria, energy and hall rows', () => {
    const c = (fixtureTables.cafeteria_outlets as CafeteriaOutletRow[]).find((r) => r.id === 'main')!;
    expect(c).toMatchObject({ counters: 6, service_rate_per_counter_15min: 18, opens_min: 450, closes_min: 1200, staff: 6, diner_share: 0.5 });
    const e = fixtureTables.energy_profiles as EnergyProfileRow[];
    expect(e).toHaveLength(8);
    for (const r of e) { expect(r.occupied_room_kw).toBe(6); expect(r.idle_room_kw).toBe(2); }
    expect((fixtureTables.waiting_halls as WaitingHallRow[])[0]).toMatchObject({ id: 'main-hall', capacity: 400, load_kw: 30, block: 'B' });
  });
});
