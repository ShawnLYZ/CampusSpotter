export type Label = 'verified' | 'baseline' | 'ai';
export interface Labeled<T> { value: T; label: Label; sourceId: string }

export const BLOCK_IDS = ['A', 'B', 'C', 'D', 'E', 'S', 'L', 'U'] as const;   // S = Spine rooms, L = Library, U = location unconfirmed
export type BlockId = (typeof BLOCK_IDS)[number];
export const ROOM_TYPES = ['classroom', 'lab', 'auditorium'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export type RoomCounts = Record<RoomType, number>;

export type DayType = 'weekday' | 'friday' | 'weekend' | 'no_class';
export type DisruptionType = 'stadium_event' | 'apu_calendar' | 'weekly_pattern' | 'weather' | 'manual';
export type DisruptionKind = 'concert' | 'sports' | 'intake' | 'holiday' | 'break' | 'friday_prayer' | 'heavy_rain' | 'other';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface DisruptionRef {
  id: string; type: DisruptionType; kind: DisruptionKind; title: string; venue: string | null;
  startMin: number; endMin: number;                 // relative to 00:00 MYT on the context date; may be < 0 or > 1440
  expectedAttendance: Labeled<number> | null;
}
export interface Context { date: string; dayType: DayType; disruptions: DisruptionRef[]; reconstructed: boolean }

export interface SessionGroup {                      // D19: counts of sessions sharing block × room type × start × end
  block: BlockId; roomType: RoomType; startMin: number; endMin: number; count: number;
  firstOfDayShare: number;                           // 0..1
  lastOfDayShare: number;                            // 0..1
}
export interface TimetableDay {
  date: string; label: Label; sourceId: string;
  groups: SessionGroup[];
  conditioned: Record<BlockId, RoomCounts[]>;        // 76 entries per block (D1)
}
export type SeatsTable = Record<BlockId, Record<RoomType, Labeled<number>>>;

export interface Departure { min: number; limitedSeats: boolean }
export interface TimeWindow { fromMin: number; toMin: number }                    // [from, to)
export interface ShuttleDay {
  label: Label; sourceId: string; service: 'normal' | 'reduced' | 'none';
  apuToLrt: Departure[]; lrtToApu: Departure[]; loops: TimeWindow[];
}
export interface RoadSeries {
  kind: 'google' | 'typical' | 'reconstructed';
  ratio: (Labeled<number> | null)[];                 // 20 hourly points: predicted ÷ static, mean of both directions
  googleStaticOneWayMin: Labeled<number> | null;     // shown for comparison only (D7)
}
export interface WeatherSeries { precipitationMm: (Labeled<number> | null)[]; probabilityPct: (Labeled<number> | null)[] }  // 20 hourly points
export interface PrayerDay { date: string; zuhrMin: Labeled<number> }
export interface RidershipInput { typicalDailyBoardings: Labeled<number>; typicalDailyAlightings: Labeled<number> }

export type EstimateKey = 'eventRoadUplift' | 'eventArrivalCurve' | 'eventDepartureCurve' | 'eventLrtModeShare'
  | 'attendanceDrop' | 'dinnerStayShare' | 'advisoryCompliance' | 'intakeShuttleDemand';
export interface Estimate {
  key: EstimateKey; disruptionId: string;
  likely: number | number[]; low: number | number[]; high: number | number[];
  unit: string; reasoning: string; confidence: 'low' | 'medium' | 'high'; model: string; createdAt: string; clamped: boolean;
}

export interface CafeteriaOutlet {
  id: string; name: string; zone: string; counters: Labeled<number>; servicePerCounter15: Labeled<number>;
  opensMin: number; closesMin: number; staff: Labeled<number>; dinerShare: Labeled<number>;
}
export interface WaitingHall { id: string; name: string; block: BlockId; capacity: Labeled<number>; loadKw: Labeled<number> }
export interface EnergyProfile { baseLoadKw: Labeled<number>; occupiedRoomKw: Labeled<number>; idleRoomKw: Labeled<number> }

export interface Baseline {
  population: Labeled<number>; residentShare: Labeled<number>; shuttleShare: Labeled<number>;
  attendeesPerSession: Labeled<number>; attendanceRate: Labeled<number>;
  leaveSpreadMin: Labeled<number>; arriveSpreadMin: Labeled<number>;
  freeFlowOneWayMin: Labeled<number>; loadingMinPerTerminal: Labeled<number>;
  fleetSize: Labeled<number>; busSeats: Labeled<number>;
  giveUpWaitMin: Labeled<number>; giveUpRatePerHour: Labeled<number>; defaultStayShare: Labeled<number>;
  stopOutdoorCapacity: Labeled<number>; keptOpenBlock: BlockId;
  rainFactor: Labeled<number>; rainThresholdMmPerH: Labeled<number>;
  eatOnCampusShare: Labeled<number>; lunchSpreadMin: Labeled<number>;
  walkwayCapacityPerMin: Labeled<number>; fridayPrayerShare: Labeled<number>;
  seatsByType: Record<RoomType, Labeled<number>>;
  lrtHourlyProfile: Labeled<number[]>;                // 20 shares of daily station flow
  typicalRoadRatio: Labeled<number[]>;                // 20 hourly ratios (D2)
  energy: Record<BlockId, EnergyProfile>;
  cafeterias: CafeteriaOutlet[];                      // first entry = main cafeteria (the metric)
  waitingHalls: WaitingHall[];
}

export const METRIC_IDS = ['classroomOccupancy', 'cafeteriaQueue', 'buildingEnergy', 'walkwayTraffic',
  'apuStopQueue', 'lrtStopQueue', 'shuttleRtt', 'roadDelay', 'lrtCrowding'] as const;
export type MetricId = (typeof METRIC_IDS)[number];
export const PRIMARY_METRICS: readonly MetricId[] = ['classroomOccupancy', 'cafeteriaQueue', 'buildingEnergy',
  'walkwayTraffic', 'apuStopQueue', 'lrtStopQueue', 'shuttleRtt'];
export const SECONDARY_METRICS: readonly MetricId[] = ['roadDelay', 'lrtCrowding'];

export interface Threshold { amberFrom: number; redAbove: number; greenInclusive: boolean }
export interface RiskRules { criticalRedMin: number; criticalApuWaitMin: number; criticalLeftBehind: number; highRedMin: number; mediumAmberMin: number }
export interface Settings {
  defaultBudgetRm: Labeled<number>;
  busOneWayRm: Labeled<number>; busHalfDayRm: Labeled<number>; busFullDayRm: Labeled<number>;
  staffRatePerHourRm: Labeled<number>; staffPerCounter: Labeled<number>;
  tariffPeakSenPerKwh: Labeled<number>; tariffOffPeakSenPerKwh: Labeled<number>;
  peakFromMin: number; peakToMin: number;            // weekdays only
  thresholds: Record<MetricId, Threshold>;
  risk: RiskRules;
}

export interface InputBundle {
  context: Context; baseline: Baseline; settings: Settings;
  timetable: TimetableDay | null; seats: SeatsTable; shuttle: ShuttleDay; road: RoadSeries;
  weather: WeatherSeries | null; prayer: PrayerDay | null; ridership: RidershipInput | null; estimates: Estimate[];
}

export type BlockSel = BlockId[] | 'all';
export type Lever =
  | { kind: 'classesOnline'; fromMin: number; toMin: number; blocks: BlockSel }
  | { kind: 'stagger'; target: 'end' | 'start'; fromMin: number; toMin: number; shifts: Partial<Record<BlockId, number>> }
  | { kind: 'extraBuses'; buses: number; fromMin: number; toMin: number }
  | { kind: 'nonstopLoop'; fromMin: number; toMin: number }
  | { kind: 'busesAtLrt'; buses: number; atMin: number }
  | { kind: 'cafeteria'; outletId: string; extraCounters: number; fromMin: number; toMin: number; closeAtMin: number | null }
  | { kind: 'waitingHall'; hallId: string; fromMin: number; toMin: number }
  | { kind: 'acOffInGap'; fromMin: number; toMin: number; blocks: BlockSel }
  | { kind: 'advisory'; advisedMin: number; message: 'leave_before' | 'walk_to_lrt' | 'expect_delays' }
  | { kind: 'studentCount'; percent: number };
export type LeverKind = Lever['kind'];
export type LeverSet = Lever[];
