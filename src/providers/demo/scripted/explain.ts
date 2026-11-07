import { clock12 as clock, durationText, rmText } from '@engine/index.ts';
import type { Summary } from '@engine/index.ts';

const d = (min: number | null): string => (min === null ? 'no shuttle queue' : durationText(min));

/** Fixed-template explanation. Every number comes from the two summaries, formatted; nothing is computed beyond rounding. */
export function explainScripted(noAction: Summary, withPlan: Summary): string {
  const at = noAction.peaks.apuStopQueue.atMin;
  const parts = [
    `With no action, the APU stop wait peaks at ${d(noAction.peakApuWaitMin)}${at === null ? '' : ` around ${clock(at)}`} and ${noAction.totalRedMinutes} minutes are spent in red across the day.`,
    `With the plan, the peak falls to ${d(withPlan.peakApuWaitMin)} and time in red drops to ${withPlan.totalRedMinutes} minutes.`,
    `It costs ${rmText(withPlan.totalCostRm)}.`,
  ];
  const { sessionsMoved, share } = withPlan.learningDisruption;
  if (sessionsMoved > 0) parts.push(`${sessionsMoved} sessions move online (${Math.round(share * 100)}% of the day).`);
  const before = Math.round(noAction.studentHoursWaited);
  const after = Math.round(withPlan.studentHoursWaited);
  if (after < before) parts.push(`Student-hours spent waiting fall from ${before} to ${after}.`);
  return parts.join(' ');
}
