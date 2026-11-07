import type { Label, BlockId, RoomType, Settings, EstimateKey, DisruptionType, DisruptionKind, RiskLevel } from '../engine/types.ts';
export type TableName = 'baseline_values' | 'settings' | 'rooms' | 'cafeteria_outlets' | 'energy_profiles' | 'waiting_halls'
  | 'shuttle_timetable' | 'timetable_days' | 'timetable_groups' | 'timetable_conditioned' | 'prayer_times' | 'weather_hourly'
  | 'traffic_cache' | 'lrt_ridership_daily' | 'disruptions' | 'disruption_sources' | 'ai_estimates' | 'sources';
export interface BaselineValueRow { key: string; value: unknown; unit: string; label: Label; description: string; source_id: string; updated_at: string }
export interface SettingsRow { id: 1; value: Settings; updated_at: string }
export interface RoomRow { code: string; block: BlockId; level: string | null; room_type: RoomType; seats: number; seats_label: Label }
export interface CafeteriaOutletRow { id: string; name: string; zone: string; counters: number; service_rate_per_counter_15min: number; opens_min: number; closes_min: number; staff: number; diner_share: number; label: Label }
export interface EnergyProfileRow { block: BlockId; base_load_kw: number; occupied_room_kw: number; idle_room_kw: number; label: Label }
export interface WaitingHallRow { id: string; name: string; block: BlockId; capacity: number; load_kw: number; label: Label }
export interface ShuttleRow { service: 'normal' | 'reduced'; direction: 'apu_to_lrt' | 'lrt_to_apu' | 'loop'; departure_min: number; loop_to_min: number | null; limited_seats: boolean; label: Label; source_id: string; effective_from: string }
export interface TimetableDayRow { date: string; sessions: number; label: Label; synced_at: string }
export interface TimetableGroupRow { date: string; block: BlockId; room_type: RoomType; start_min: number; end_min: number; count: number; first_of_day_share: number; last_of_day_share: number }
export interface TimetableConditionedRow { date: string; block: BlockId; room_type: RoomType; step: number; rooms: number }
export interface PrayerRow { date: string; zone: string; fajr_min: number; dhuhr_min: number; asr_min: number; maghrib_min: number; isha_min: number; fetched_at: string }
export interface WeatherRow { time: string; precipitation_mm: number | null; precipitation_probability: number | null; fetched_at: string }
export interface TrafficRow { date: string; hour_index: number; direction: 'apu_to_lrt' | 'lrt_to_apu'; kind: 'google' | 'reconstructed'; duration_s: number; static_duration_s: number; fetched_at: string }
export interface RidershipRow { date: string; station: string; boardings: number; alightings: number }
export interface DisruptionRow {
  id: string; title: string; type: DisruptionType; kind: DisruptionKind; venue: string | null; start_at: string; end_at: string;
  expected_attendance: number | null; attendance_label: Label | null; origin: 'scan' | 'manual' | 'rule';
  override_start_at: string | null; override_end_at: string | null; override_attendance: number | null; overridden_by: string | null; overridden_at: string | null;
  status: 'active' | 'dismissed'; risk_level: RiskLevel | null; risk_reason: string | null; risk_peaks: unknown | null; risk_computed_at: string | null;
  notes: string | null; dedupe_key: string | null; created_by: string | null; updated_at: string;
}
export interface DisruptionSourceRow { disruption_id: string; url: string; title: string | null; published_at: string | null; fetched_at: string }
export interface EstimateRow { context_hash: string; disruption_id: string; date: string; key: EstimateKey; likely: number | number[]; low: number | number[]; high: number | number[]; unit: string; reasoning: string; confidence: 'low' | 'medium' | 'high'; model: string; clamped: boolean; created_at: string }
export interface SourceRow { id: string; name: string; label: Label; url: string | null; licence: string; job_name: string | null; expected_interval_h: number | null; description: string }
