import type { Label, MetricId, BlockId, LeverKind, LeverSet, Context, RiskLevel } from './types.ts';
export type { RiskLevel } from './types.ts';

export type StepStatus = 'ok' | 'no_service' | 'not_enough_data';
export type Pressure = 'green' | 'amber' | 'red';
export type MetricUnit = 'percent' | 'minutes' | 'ratio' | 'percent_vs_normal';
export interface StepValue { value: number | null; status: StepStatus; pressure: Pressure | null; provenance: Label | null }
export interface MetricSeries { metric: MetricId; unit: MetricUnit; steps: StepValue[]; inputs: string[]; detail: Record<string, number[]> }
export interface PerBlock { occupancy: StepValue[]; energy: StepValue[]; energyKwh: number[] }
export interface CostLine { kind: LeverKind; text: string; rm: number }
export interface Peak { value: number | null; atMin: number | null }
export interface Summary {
  peaks: Record<MetricId, Peak>; redMinutes: Record<MetricId, number>; amberMinutes: Record<MetricId, number>;
  peakApuWaitMin: number | null; peakApuQueue: Peak; peakLrtWaitMin: number | null; totalRedMinutes: number; lastApuMin: number | null;
  studentHoursWaited: number; leftBehind: number; extraEnergyKwh: number; extraEnergyRm: number;
  costLines: CostLine[]; totalCostRm: number;
  learningDisruption: { sessionsMoved: number; sessionsScheduled: number; share: number };
}
export interface RiskResult { level: RiskLevel; reason: string; worst: { metric: MetricId; value: number; atMin: number } | null }
export type WarningCode = 'not_enough_data' | 'traffic_assumed_typical' | 'weather_missing' | 'estimate_missing'
  | 'reconstructed' | 'lever_adjusted' | 'lever_dropped' | 'timetable_fallback';
export interface Warning { code: WarningCode; message: string; metric?: MetricId; fromMin?: number; toMin?: number }
export interface Forecast {
  engineVersion: string; context: Context; levers: LeverSet;
  metrics: Record<MetricId, MetricSeries>; perBlock: Record<BlockId, PerBlock>;
  summary: Summary; risk: RiskResult | null; warnings: Warning[];
}
export interface PlanEvaluation { noAction: Forecast; withPlan: Forecast; overBudget: boolean }

export const METRIC_TITLES: Record<MetricId, string> = {
  classroomOccupancy: 'Classroom occupancy',
  cafeteriaQueue: 'Cafeteria queue',
  buildingEnergy: 'Building energy',
  walkwayTraffic: 'Walkway foot traffic',
  apuStopQueue: 'APU stop queue',
  lrtStopQueue: 'LRT stop queue',
  shuttleRtt: 'Shuttle round trip',
  roadDelay: 'Road delay',
  lrtCrowding: 'LRT station crowding',
};
export const METRIC_UNITS: Record<MetricId, MetricUnit> = {
  classroomOccupancy: 'percent',
  walkwayTraffic: 'percent',
  buildingEnergy: 'percent_vs_normal',
  cafeteriaQueue: 'minutes',
  apuStopQueue: 'minutes',
  lrtStopQueue: 'minutes',
  shuttleRtt: 'minutes',
  roadDelay: 'ratio',
  lrtCrowding: 'ratio',
};
