import { clock12 as clock, durationText, rmText, runForecast, scoreRisk, topPeaks } from '@engine/index.ts';
import type { Summary } from '@engine/index.ts';
import type { DataProvider } from '../../providers/DataProvider.ts';
import type { EarlyWarningItem } from '../../providers/types.ts';

export interface Milestone { id: 'jun3' | 'oct21' | 'nov3' | 'nov4'; date: string; title: string; text: string }

export const MILESTONES: Milestone[] = [
  { id: 'jun3', date: '2026-06-03', title: 'Tickets sell out', text: 'CampusSpotter flags the 4 Nov concert as Critical.' },
  { id: 'oct21', date: '2026-10-21', title: 'Plan chosen', text: 'About two weeks before, management picks a plan within RM 2,000.' },
  { id: 'nov3', date: '2026-11-03', title: 'Advisory sent', text: 'Students are told to leave campus before 12:00 PM.' },
  { id: 'nov4', date: '2026-11-04', title: 'The day itself', text: 'What happened with no action, next to what CampusSpotter would have done.' },
];

const CONCERT_ID = 'weeknd-2026-11-04';
const CONCERT_DATE = '2026-11-04';
const JUN3_TO_NOV4_DAYS = 154;

/** The concert as it looked on 3 Jun: its risk is recomputed on the non-reconstructed 4 Nov bundle, with a 154-day countdown. */
export async function buildJun3Card(provider: DataProvider): Promise<EarlyWarningItem> {
  const item = await provider.getDisruption(CONCERT_ID);
  if (!item) throw new Error(`disruption not found: ${CONCERT_ID}`);
  const bundle = await provider.getInputBundle({ date: CONCERT_DATE });
  const forecast = runForecast(bundle, []);
  const risk = scoreRisk(forecast, bundle.settings);
  const peaks = topPeaks(forecast, bundle.settings, 3).map(({ metric, value, atMin }) => ({ metric, value, atMin }));
  return { ...item, riskLevel: risk.level, riskReason: risk.reason, topPeaks: peaks, daysRemaining: JUN3_TO_NOV4_DAYS, isPast: false };
}

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const d = (min: number | null): string => (min === null ? 'no shuttle queue' : durationText(min));

/** Fixed-template replay story. Every number comes from the inputs, formatted. */
export function replayNarrative(
  noAction: Summary,
  withPlan: Summary,
  station: { boardings: number; alightings: number; typicalBoardings: number | null } | null,
): string {
  const { value, atMin } = noAction.peakApuQueue;
  const queue = value === null ? 'no students were queuing'
    : `about ${fmt(value)} students were queuing${atMin === null ? '' : ` around ${clock(atMin)}`}`;
  const parts = ['On 4 November, traffic around LRT Bukit Jalil jammed from about 12:00 PM.'];
  if (station) {
    const normal = station.typicalBoardings === null ? '' : `, against about ${fmt(station.typicalBoardings)} on a normal day`;
    parts.push(`LRT Bukit Jalil recorded ${fmt(station.alightings)} alightings and ${fmt(station.boardings)} boardings that day${normal}.`);
  }
  parts.push(
    `With no action, the APU stop wait reached ${d(noAction.peakApuWaitMin)} and ${queue}.`,
    `With CampusSpotter's plan, moving classes from 10:45 AM online and running a nonstop loop before the jam, the peak wait falls to ${d(withPlan.peakApuWaitMin)} for ${rmText(withPlan.totalCostRm)}.`,
    'All figures are reconstructed estimates.',
  );
  return parts.join(' ');
}
