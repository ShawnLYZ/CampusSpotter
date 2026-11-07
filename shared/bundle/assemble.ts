import type {
  Baseline, BlockId, CafeteriaOutlet, DayType, Departure, DisruptionRef, Estimate, EnergyProfile, InputBundle, Label, Labeled,
  RidershipInput, RoadSeries, RoomCounts, RoomType, SeatsTable, SessionGroup, ShuttleDay, TimeWindow, TimetableDay,
  WaitingHall, WeatherSeries, PrayerDay,
} from '../engine/types.ts';
import { BLOCK_IDS, ROOM_TYPES } from '../engine/types.ts';
import { HOURLY_POINTS, STEPS, addDays, calendarDayType, dayOfWeek, hourSlot } from '../engine/grid.ts';
import type {
  BaselineValueRow, CafeteriaOutletRow, DisruptionRow, EnergyProfileRow, EstimateRow, PrayerRow, RidershipRow, RoomRow, SettingsRow,
  ShuttleRow, TableName, TimetableConditionedRow, TimetableDayRow, TimetableGroupRow, TrafficRow, WaitingHallRow, WeatherRow,
} from './rows.ts';

export interface RowFilter { column: string; op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in'; value: unknown }
export interface RowsClient { select(table: TableName, filters?: RowFilter[]): Promise<unknown[]> }

function matches(row: Record<string, unknown>, f: RowFilter): boolean {
  const v = row[f.column] as string | number;
  const t = f.value as string | number;
  switch (f.op) {
    case 'eq': return v === t;
    case 'neq': return v !== t;
    case 'gt': return v > t;
    case 'gte': return v >= t;
    case 'lt': return v < t;
    case 'lte': return v <= t;
    case 'in': return (f.value as unknown[]).includes(v);
  }
}

export function memoryRowsClient(tables: Partial<Record<TableName, unknown[]>>): RowsClient {
  return {
    async select(table, filters = []) {
      const rows = (tables[table] ?? []) as Record<string, unknown>[];
      return rows.filter((r) => filters.every((f) => matches(r, f)));
    },
  };
}

export interface BundleRows {
  date: string; timetableDate: string | null; timetableLabel: Label | null;
  disruptions: DisruptionRow[]; baselineValues: BaselineValueRow[]; settings: SettingsRow; rooms: RoomRow[];
  cafeteriaOutlets: CafeteriaOutletRow[]; energyProfiles: EnergyProfileRow[]; waitingHalls: WaitingHallRow[];
  shuttle: ShuttleRow[]; timetableGroups: TimetableGroupRow[]; timetableConditioned: TimetableConditionedRow[];
  prayer: PrayerRow[]; weather: WeatherRow[]; traffic: TrafficRow[]; ridership: RidershipRow[]; estimates: EstimateRow[];
}

const f = (column: string, op: RowFilter['op'], value: unknown): RowFilter => ({ column, op, value });

export async function fetchBundleRows(client: RowsClient, date: string): Promise<BundleRows> {
  const sel = async <T>(table: TableName, filters?: RowFilter[]): Promise<T[]> => (await client.select(table, filters)) as T[];
  const next = addDays(date, 1);
  const disruptions = await sel<DisruptionRow>('disruptions', [
    f('status', 'eq', 'active'), f('start_at', 'lt', `${next}T00:00:00+08:00`), f('end_at', 'gt', `${date}T00:00:00+08:00`),
  ]);
  const days = await sel<TimetableDayRow>('timetable_days');
  const picked = pickTimetableDate(date, days);
  const byDate = picked ? [f('date', 'eq', picked.date)] : null;
  const [baselineValues, settingsRows, rooms, cafeteriaOutlets, energyProfiles, waitingHalls, shuttle, timetableGroups, timetableConditioned,
    prayer, weather, traffic, ridership, estimates] = await Promise.all([
    sel<BaselineValueRow>('baseline_values'), sel<SettingsRow>('settings'), sel<RoomRow>('rooms'),
    sel<CafeteriaOutletRow>('cafeteria_outlets'), sel<EnergyProfileRow>('energy_profiles'), sel<WaitingHallRow>('waiting_halls'),
    sel<ShuttleRow>('shuttle_timetable'),
    byDate ? sel<TimetableGroupRow>('timetable_groups', byDate) : Promise.resolve([] as TimetableGroupRow[]),
    byDate ? sel<TimetableConditionedRow>('timetable_conditioned', byDate) : Promise.resolve([] as TimetableConditionedRow[]),
    sel<PrayerRow>('prayer_times', [f('date', 'eq', date)]),
    sel<WeatherRow>('weather_hourly', [f('time', 'gte', `${date}T07:00:00+08:00`), f('time', 'lt', `${next}T03:00:00+08:00`)]),
    sel<TrafficRow>('traffic_cache', [f('date', 'eq', date)]),
    sel<RidershipRow>('lrt_ridership_daily', [f('date', 'gte', addDays(date, -56)), f('date', 'lt', date)]),
    disruptions.length
      ? sel<EstimateRow>('ai_estimates', [f('disruption_id', 'in', disruptions.map((d) => d.id))])
      : Promise.resolve([] as EstimateRow[]),
  ]);
  if (settingsRows.length === 0) throw new Error('missing settings row');
  return {
    date, timetableDate: picked?.date ?? null, timetableLabel: picked?.label ?? null, disruptions, baselineValues,
    settings: settingsRows[0], rooms, cafeteriaOutlets, energyProfiles, waitingHalls, shuttle, timetableGroups, timetableConditioned,
    prayer, weather, traffic, ridership, estimates,
  };
}

export function effectiveTimes(row: DisruptionRow): { start_at: string; end_at: string; expected_attendance: number | null } {
  return {
    start_at: row.override_start_at ?? row.start_at,
    end_at: row.override_end_at ?? row.end_at,
    expected_attendance: row.override_attendance ?? row.expected_attendance,
  };
}

export function overlapsDate(row: Pick<DisruptionRow, 'start_at' | 'end_at'>, date: string): boolean {
  return Date.parse(row.start_at) < Date.parse(`${addDays(date, 1)}T00:00:00+08:00`) && Date.parse(row.end_at) > Date.parse(`${date}T00:00:00+08:00`);
}

/** MYT (UTC+8) calendar date and hour of an instant, regardless of the offset the timestamp is written in. */
export function mytParts(iso: string): { date: string; hour: number } {
  const d = new Date(Date.parse(iso) + 8 * 3600 * 1000);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return { date: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`, hour: d.getUTCHours() };
}

export function dayTypeFor(date: string, disruptions: DisruptionRow[]): DayType {
  const off = disruptions.some((d) => (d.kind === 'holiday' || d.kind === 'break') && overlapsDate(effectiveTimes(d), date));
  return off ? 'no_class' : calendarDayType(date);
}

export function pickTimetableDate(date: string, available: TimetableDayRow[]): { date: string; label: Label } | null {
  if (available.some((d) => d.date === date)) return { date, label: 'verified' };
  const dow = dayOfWeek(date);
  // Beyond the latest captured date this is the latest same-weekday date; otherwise the latest earlier one.
  const earlier = available.map((d) => d.date).filter((d) => d < date && dayOfWeek(d) === dow).sort();
  return earlier.length ? { date: earlier[earlier.length - 1], label: 'baseline' } : null;
}

function dayClass(date: string): 'monThu' | 'fri' | 'weekend' {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6 ? 'weekend' : dow === 5 ? 'fri' : 'monThu';
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function typicalRidership(rows: RidershipRow[], date: string): RidershipInput | null {
  const cls = dayClass(date);
  const picked = rows.filter((r) => r.station === 'SP17: Bukit Jalil' && r.date < date && dayClass(r.date) === cls)
    .sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  if (picked.length < 3) return null;
  const mk = (value: number): Labeled<number> => ({ value, label: 'verified', sourceId: 'data-gov-my-ridership' });
  return { typicalDailyBoardings: mk(median(picked.map((r) => r.boardings))), typicalDailyAlightings: mk(median(picked.map((r) => r.alightings))) };
}

const RANK: Record<Label, number> = { ai: 0, baseline: 1, verified: 2 };
const weakest = (labels: Label[]): Label => labels.reduce((a, b) => (RANK[b] < RANK[a] ? b : a), 'verified' as Label);

const camel = (k: string): string => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const labeled = <T>(value: T, label: Label, sourceId: string): Labeled<T> => ({ value, label, sourceId });

const SCALAR_KEYS = ['population', 'resident_share', 'shuttle_share', 'attendees_per_session', 'attendance_rate', 'leave_spread_min',
  'arrive_spread_min', 'free_flow_one_way_min', 'loading_min_per_terminal', 'fleet_size', 'bus_seats', 'give_up_wait_min',
  'give_up_rate_per_hour', 'default_stay_share', 'stop_outdoor_capacity', 'rain_factor', 'rain_threshold_mm_per_h',
  'eat_on_campus_share', 'lunch_spread_min', 'walkway_capacity_per_min', 'friday_prayer_share'];

function buildBaseline(rows: BundleRows): Baseline {
  const byKey = new Map(rows.baselineValues.map((r) => [r.key, r]));
  const need = (key: string): BaselineValueRow => {
    const r = byKey.get(key);
    if (!r) throw new Error(`missing baseline key: ${key}`);
    return r;
  };
  const lab = <T>(key: string): Labeled<T> => { const r = need(key); return labeled(r.value as T, r.label, r.source_id); };
  const out: Record<string, unknown> = {};
  for (const k of SCALAR_KEYS) out[camel(k)] = lab<number>(k);
  const seatsByType = {} as Record<RoomType, Labeled<number>>;
  for (const t of ROOM_TYPES) seatsByType[t] = lab<number>(`seats_${t}`);
  const energy = {} as Record<BlockId, EnergyProfile>;
  for (const b of BLOCK_IDS) {
    const e = rows.energyProfiles.find((r) => r.block === b);
    if (!e) throw new Error(`missing energy profile: ${b}`);
    const mk = (v: number): Labeled<number> => labeled(v, e.label, 'apu-assumption');
    energy[b] = { baseLoadKw: mk(e.base_load_kw), occupiedRoomKw: mk(e.occupied_room_kw), idleRoomKw: mk(e.idle_room_kw) };
  }
  const cafeterias: CafeteriaOutlet[] = rows.cafeteriaOutlets.map((c) => {
    const mk = (v: number): Labeled<number> => labeled(v, c.label, 'apu-assumption');
    return { id: c.id, name: c.name, zone: c.zone, counters: mk(c.counters), servicePerCounter15: mk(c.service_rate_per_counter_15min),
      opensMin: c.opens_min, closesMin: c.closes_min, staff: mk(c.staff), dinerShare: mk(c.diner_share) };
  });
  const waitingHalls: WaitingHall[] = rows.waitingHalls.map((h) => ({
    id: h.id, name: h.name, block: h.block, capacity: labeled(h.capacity, h.label, 'apu-assumption'), loadKw: labeled(h.load_kw, h.label, 'apu-assumption'),
  }));
  return {
    ...out, keptOpenBlock: need('kept_open_block').value as BlockId, seatsByType,
    lrtHourlyProfile: lab<number[]>('lrt_hourly_profile'), typicalRoadRatio: lab<number[]>('typical_road_ratio'),
    energy, cafeterias, waitingHalls,
  } as unknown as Baseline;
}

function buildSeats(rows: RoomRow[], baseline: Baseline): SeatsTable {
  const out = {} as SeatsTable;
  for (const b of BLOCK_IDS) {
    out[b] = {} as SeatsTable[BlockId];
    for (const t of ROOM_TYPES) {
      const rs = rows.filter((r) => r.block === b && r.room_type === t);
      out[b][t] = rs.length
        ? labeled(rs.reduce((s, r) => s + r.seats, 0) / rs.length, weakest(rs.map((r) => r.seats_label)), 'apu-timetable')
        : baseline.seatsByType[t];
    }
  }
  return out;
}

function buildShuttle(rows: ShuttleRow[], dayType: DayType, onBreak: boolean, onHoliday: boolean): ShuttleDay {
  if (dayType === 'weekend' || onHoliday) {
    return { label: 'verified', sourceId: 'apu-shuttle-2025-05', service: 'none', apuToLrt: [], lrtToApu: [], loops: [] };
  }
  const service = onBreak ? 'reduced' : 'normal';
  const used = rows.filter((r) => r.service === service);
  const deps = (dir: ShuttleRow['direction']): Departure[] =>
    used.filter((r) => r.direction === dir).map((r) => ({ min: r.departure_min, limitedSeats: r.limited_seats })).sort((a, b) => a.min - b.min);
  const loops: TimeWindow[] = used.filter((r) => r.direction === 'loop')
    .map((r) => ({ fromMin: r.departure_min, toMin: r.loop_to_min ?? r.departure_min })).sort((a, b) => a.fromMin - b.fromMin);
  return {
    label: used.length ? weakest(used.map((r) => r.label)) : 'verified', sourceId: used[0]?.source_id ?? 'apu-shuttle-2025-05',
    service, apuToLrt: deps('apu_to_lrt'), lrtToApu: deps('lrt_to_apu'), loops,
  };
}

function buildTimetable(rows: BundleRows, dayType: DayType): TimetableDay | null {
  const conditioned = {} as Record<BlockId, RoomCounts[]>;
  for (const b of BLOCK_IDS) conditioned[b] = Array.from({ length: STEPS }, () => ({ classroom: 0, lab: 0, auditorium: 0 }));
  if (dayType === 'no_class') return { date: rows.date, label: 'verified', sourceId: 'apu-timetable', groups: [], conditioned };
  if (rows.timetableDate === null || rows.timetableLabel === null) return null;
  const groups: SessionGroup[] = rows.timetableGroups.filter((g) => g.date === rows.timetableDate).map((g) => ({
    block: g.block, roomType: g.room_type, startMin: g.start_min, endMin: g.end_min, count: g.count,
    firstOfDayShare: g.first_of_day_share, lastOfDayShare: g.last_of_day_share,
  }));
  for (const c of rows.timetableConditioned) {
    if (c.date === rows.timetableDate && c.step >= 0 && c.step < STEPS) conditioned[c.block][c.step][c.room_type] = c.rooms;
  }
  return { date: rows.timetableDate, label: rows.timetableLabel, sourceId: 'apu-timetable', groups, conditioned };
}

function buildRoad(rows: BundleRows, baseline: Baseline, reconstructed: boolean): RoadSeries {
  const sv = rows.baselineValues.find((r) => r.key === 'google_static_one_way_min');
  const googleStaticOneWayMin = sv ? labeled(sv.value as number, sv.label, sv.source_id) : null;
  const kind = reconstructed ? 'reconstructed' : 'google';
  const tr = rows.traffic.filter((r) => r.kind === kind);
  if (tr.length === 0) {
    const t = baseline.typicalRoadRatio;
    return { kind: 'typical', ratio: t.value.map((v) => labeled(v, 'baseline', t.sourceId)), googleStaticOneWayMin };
  }
  const label: Label = reconstructed ? 'baseline' : 'verified';
  const sourceId = reconstructed ? 'reconstruction-4nov' : 'google-routes';
  const ratio: (Labeled<number> | null)[] = [];
  for (let h = 0; h < HOURLY_POINTS; h++) {
    const rs = tr.filter((r) => r.hour_index === h);
    ratio.push(rs.length ? labeled(rs.reduce((s, r) => s + r.duration_s / r.static_duration_s, 0) / rs.length, label, sourceId) : null);
  }
  return { kind, ratio, googleStaticOneWayMin };
}

function buildWeather(rows: WeatherRow[], date: string): WeatherSeries | null {
  if (rows.length === 0) return null;
  const precipitationMm: (Labeled<number> | null)[] = new Array(HOURLY_POINTS).fill(null);
  const probabilityPct: (Labeled<number> | null)[] = new Array(HOURLY_POINTS).fill(null);
  for (const r of rows) {
    const p = mytParts(r.time);
    const slot = hourSlot(p.date, p.hour);
    if (!slot || slot.contextDate !== date) continue;
    if (r.precipitation_mm != null) precipitationMm[slot.hourIndex] = labeled(r.precipitation_mm, 'verified', 'open-meteo');
    if (r.precipitation_probability != null) probabilityPct[slot.hourIndex] = labeled(r.precipitation_probability, 'verified', 'open-meteo');
  }
  return { precipitationMm, probabilityPct };
}

const minutesOf = (iso: string, date: string): number => (Date.parse(iso) - Date.parse(`${date}T00:00:00+08:00`)) / 60000;

function buildRef(d: DisruptionRow, date: string): DisruptionRef {
  const t = effectiveTimes(d);
  const expectedAttendance: Labeled<number> | null = d.override_attendance != null
    ? labeled(d.override_attendance, 'verified', 'manual-override')
    : d.expected_attendance != null ? labeled(d.expected_attendance, d.attendance_label ?? 'baseline', `disruption:${d.id}`) : null;
  return { id: d.id, type: d.type, kind: d.kind, title: d.title, venue: d.venue,
    startMin: minutesOf(t.start_at, date), endMin: minutesOf(t.end_at, date), expectedAttendance };
}

function latestEstimates(rows: EstimateRow[]): Estimate[] {
  const best = new Map<string, EstimateRow>();
  for (const r of rows) {
    const k = `${r.disruption_id}|${r.key}`;
    const cur = best.get(k);
    if (!cur || r.created_at > cur.created_at) best.set(k, r);
  }
  return [...best.values()].map((r) => ({
    key: r.key, disruptionId: r.disruption_id, likely: r.likely, low: r.low, high: r.high, unit: r.unit, reasoning: r.reasoning,
    confidence: r.confidence, model: r.model, createdAt: r.created_at, clamped: r.clamped,
  }));
}

export function assembleBundle(rows: BundleRows, opts: { reconstructed?: boolean } = {}): InputBundle {
  const { date } = rows;
  const dayType = dayTypeFor(date, rows.disruptions);
  const overlapping = rows.disruptions.filter((d) => d.status === 'active' && overlapsDate(effectiveTimes(d), date));
  const onHoliday = overlapping.some((d) => d.kind === 'holiday');
  const onBreak = overlapping.some((d) => d.kind === 'break');
  const refs = overlapping.map((d) => buildRef(d, date)).sort((a, b) => a.startMin - b.startMin);
  const baseline = buildBaseline(rows);
  const reconstructed = !!opts.reconstructed;
  const prayerRow = rows.prayer.find((p) => p.date === date);
  const prayer: PrayerDay | null = prayerRow ? { date, zuhrMin: labeled(prayerRow.dhuhr_min, 'verified', 'esolat') } : null;
  return {
    context: { date, dayType, disruptions: refs, reconstructed },
    baseline, settings: rows.settings.value,
    timetable: buildTimetable(rows, dayType),
    seats: buildSeats(rows.rooms, baseline),
    shuttle: buildShuttle(rows.shuttle, dayType, onBreak, onHoliday),
    road: buildRoad(rows, baseline, reconstructed),
    weather: buildWeather(rows.weather, date),
    prayer,
    ridership: typicalRidership(rows.ridership, date),
    estimates: latestEstimates(rows.estimates),
  };
}
