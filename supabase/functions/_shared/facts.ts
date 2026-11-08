import { clock12, durationText, rmText } from './engine.ts';
import type { LeverSet, Summary } from './engine.ts';

function peakLine(label: string, scenario: string, wait: number | null, atMin: number | null): string {
  if (wait === null || atMin === null) return `${label} (${scenario}): no wait recorded`;
  return `${label} (${scenario}): ${durationText(wait)} at ${clock12(atMin)}`;
}

function scenarioLines(name: string, s: Summary): string[] {
  const d = s.learningDisruption;
  return [
    peakLine('Peak APU stop wait', name, s.peakApuWaitMin, s.peakApuQueue.atMin),
    peakLine('Peak LRT stop wait', name, s.peakLrtWaitMin, s.peaks.lrtStopQueue.atMin),
    `Total red minutes (${name}): ${Math.round(s.totalRedMinutes)}`,
    `Student-hours waited (${name}): ${Math.round(s.studentHoursWaited)}`,
    `Extra energy (${name}): ${Math.round(s.extraEnergyKwh)} kWh, ${rmText(s.extraEnergyRm)}`,
    `Total cost (${name}): ${rmText(s.totalCostRm)}`,
    `Learning disruption (${name}): ${Math.round(d.share * 100)}% (${d.sessionsMoved} of ${d.sessionsScheduled} sessions moved)`,
  ];
}

export function factsSheet(noAction: Summary, withPlan: Summary, levers: LeverSet): { text: string; allowedNumbers: Set<string> } {
  const lines = [
    ...scenarioLines('no action', noAction),
    ...scenarioLines('with plan', withPlan),
    ...withPlan.costLines.map((c) => `Lever: ${c.text}`),
  ];
  if (levers.length === 0 && withPlan.costLines.length === 0) lines.push('Lever: none');
  const text = lines.join('\n');
  return { text, allowedNumbers: new Set(numberTokens(text)) };
}

function numberTokens(s: string): string[] {
  return (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((t) => t.replaceAll(',', ''));
}

/** Numbers in `text` that are not in `allowed` (commas removed before comparing). */
export function numbersOutside(text: string, allowed: Set<string>): string[] {
  return [...new Set(numberTokens(text).filter((t) => !allowed.has(t)))];
}
