import type { MetricUnit, RiskRules, Threshold } from '@engine/index.ts';

export interface Bands { green: string; amber: string; red: string }

const num = (n: number) => String(Math.round(n * 100) / 100);

function fmt(unit: MetricUnit, n: number): string {
  switch (unit) {
    case 'percent': return `${num(n)}%`;
    case 'percent_vs_normal': return `${n >= 0 ? '+' : '−'}${num(Math.abs(n))}%`;
    case 'minutes': return `${num(n)} min`;
    default: return `${num(n)}×`;
  }
}

const SUFFIX: Record<MetricUnit, string> = { percent: '%', percent_vs_normal: '%', minutes: ' min', ratio: '×' };
/** Number without its unit suffix, for the low end of a range. */
const bare = (unit: MetricUnit, n: number) => fmt(unit, n).slice(0, -SUFFIX[unit].length);

/** Written-out green / amber / red bands for one metric. */
export function thresholdBands(unit: MetricUnit, t: Threshold): Bands {
  const lo = fmt(unit, t.amberFrom);
  const hi = fmt(unit, t.redAbove);
  const green = `${t.greenInclusive ? '≤' : '<'} ${lo}`;
  const amber = t.greenInclusive ? `> ${lo} to ≤ ${hi}` : `${bare(unit, t.amberFrom)}–${hi}`;
  return { green, amber, red: `> ${hi}` };
}

/** PRD §3.5 risk rules with the configured numbers filled in. */
export function riskRuleLines(r: RiskRules): { level: string; text: string }[] {
  return [
    { level: 'Critical', text: `Any primary metric red for ≥ ${r.criticalRedMin} minutes in total, or APU stop wait > ${r.criticalApuWaitMin} min at any step, or more than ${r.criticalLeftBehind} students left behind.` },
    { level: 'High', text: `Any primary metric red for ≥ ${r.highRedMin} minutes in total.` },
    { level: 'Medium', text: `Any primary metric amber for ≥ ${r.mediumAmberMin} minutes in total, or any secondary metric red.` },
    { level: 'Low', text: 'Everything else.' },
  ];
}

export function t0Note(googleStaticMin: number): string {
  return `T0 = 6 min Baseline (OSRM); Google free-flow ${num(googleStaticMin)} min shown for comparison (D7)`;
}
