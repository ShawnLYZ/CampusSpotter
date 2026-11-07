import { PRIMARY_METRICS } from '@engine/index.ts';
import type { MetricId, Summary } from '@engine/index.ts';
import { durationText, rmText } from '../../lib/format.ts';

export const SUMMARY_ROW_LABELS = [
  'Peak APU stop wait', 'Peak LRT stop wait', 'Total time in red', 'Student-hours spent waiting',
  'Extra energy', 'Total cost', 'Learning disruption',
] as const;
export type SummaryRowLabel = (typeof SUMMARY_ROW_LABELS)[number];

export interface SummaryRowData { label: SummaryRowLabel; noAction: string; withPlan: string }

const wait = (m: number | null) => (m === null ? 'No service' : durationText(m));
const energy = (s: Summary) => `${Math.round(s.extraEnergyKwh)} kWh · ${rmText(s.extraEnergyRm)}`;
const learning = (s: Summary) => {
  const { sessionsMoved, share } = s.learningDisruption;
  return sessionsMoved === 0 ? 'None' : `${Math.round(share * 100)}% · ${sessionsMoved} sessions`;
};

export function summaryRows(noAction: Summary, withPlan: Summary): SummaryRowData[] {
  const row = (label: SummaryRowLabel, f: (s: Summary) => string): SummaryRowData => ({ label, noAction: f(noAction), withPlan: f(withPlan) });
  return [
    row('Peak APU stop wait', (s) => wait(s.peakApuWaitMin)),
    row('Peak LRT stop wait', (s) => wait(s.peakLrtWaitMin)),
    row('Total time in red', (s) => `${s.totalRedMinutes} min`),
    row('Student-hours spent waiting', (s) => String(Math.round(s.studentHoursWaited))),
    row('Extra energy', energy),
    row('Total cost', (s) => rmText(s.totalCostRm)),
    row('Learning disruption', learning),
  ];
}

/** Metrics each summary row reads, for its provenance badge. `null` means a cost figure (Baseline rates). */
export const ROW_METRICS: Record<SummaryRowLabel, readonly MetricId[] | null> = {
  'Peak APU stop wait': ['apuStopQueue'],
  'Peak LRT stop wait': ['lrtStopQueue'],
  'Total time in red': PRIMARY_METRICS,
  'Student-hours spent waiting': ['apuStopQueue', 'lrtStopQueue'],
  'Extra energy': ['buildingEnergy'],
  'Total cost': null,
  'Learning disruption': ['classroomOccupancy'],
};

/** Metrics a row reads: an array, `null` for a cost row, `undefined` for a label that is not a summary row. */
export function rowMetrics(label: string): readonly MetricId[] | null | undefined {
  return Object.hasOwn(ROW_METRICS, label) ? ROW_METRICS[label as SummaryRowLabel] : undefined;
}
