import type { MetricId, RiskLevel, Settings } from './types.ts';
import type { Forecast, RiskResult } from './output.ts';
import { METRIC_IDS, PRIMARY_METRICS, SECONDARY_METRICS } from './types.ts';
import { clock12, durationText, ratioText } from './format.ts';
import { topPeaks } from './summary.ts';

type Worst = NonNullable<RiskResult['worst']>;

const PHRASES: Record<MetricId, (v: number, at: number) => string> = {
  apuStopQueue: (v, at) => `APU stop wait peaks at ${durationText(v)} around ${clock12(at)}`,
  lrtStopQueue: (v, at) => `LRT stop wait peaks at ${durationText(v)} around ${clock12(at)}`,
  cafeteriaQueue: (v, at) => `Cafeteria wait peaks at ${durationText(v)} around ${clock12(at)}`,
  classroomOccupancy: (v, at) => `Classrooms reach ${Math.round(v)}% of seats around ${clock12(at)}`,
  walkwayTraffic: (v, at) => `The Spine reaches ${Math.round(v)}% of capacity around ${clock12(at)}`,
  buildingEnergy: (v, at) => `Building energy runs ${Math.round(v)}% above normal around ${clock12(at)}`,
  shuttleRtt: (v, at) => `Shuttle round trip reaches ${durationText(v)} around ${clock12(at)}`,
  roadDelay: (v, at) => `Road time reaches ${ratioText(v)} free-flow around ${clock12(at)}`,
  lrtCrowding: (v, at) => `LRT Bukit Jalil reaches ${ratioText(v)} normal crowding around ${clock12(at)}`,
};

/** The metric among `ids` with the most minutes (first in list order on ties), or null when none has any. */
function most(ids: readonly MetricId[], minutes: Record<MetricId, number>, atLeast: number): MetricId | null {
  let out: MetricId | null = null;
  for (const m of ids) if (minutes[m] >= atLeast && minutes[m] > 0 && (out === null || minutes[m] > minutes[out])) out = m;
  return out;
}

export function scoreRisk(f: Forecast, settings: Pick<Settings, 'risk' | 'thresholds'>): RiskResult {
  const s = f.summary;
  const rules = settings.risk;
  const peakWorst = (m: MetricId): Worst => ({ metric: m, value: s.peaks[m].value ?? 0, atMin: s.peaks[m].atMin ?? 0 });

  let level: RiskLevel;
  let worst: Worst | null = null;
  let leftBehindReason = false;

  const apuTrig = s.peakApuWaitMin !== null && s.peakApuWaitMin > rules.criticalApuWaitMin;
  const leftTrig = s.leftBehind > rules.criticalLeftBehind;
  const redCrit = PRIMARY_METRICS.some(m => s.redMinutes[m] >= rules.criticalRedMin);

  if (apuTrig || leftTrig || redCrit) {
    level = 'critical';
    if (apuTrig) worst = { metric: 'apuStopQueue', value: s.peakApuWaitMin!, atMin: s.peaks.apuStopQueue.atMin ?? 0 };
    else if (leftTrig) { worst = { metric: 'apuStopQueue', value: s.leftBehind, atMin: s.lastApuMin ?? 0 }; leftBehindReason = true; }
    else worst = peakWorst(most(PRIMARY_METRICS, s.redMinutes, rules.criticalRedMin)!);
  } else if (PRIMARY_METRICS.some(m => s.redMinutes[m] >= rules.highRedMin)) {
    level = 'high';
    worst = peakWorst(most(PRIMARY_METRICS, s.redMinutes, rules.highRedMin)!);
  } else if (PRIMARY_METRICS.some(m => s.amberMinutes[m] >= rules.mediumAmberMin) || SECONDARY_METRICS.some(m => s.redMinutes[m] > 0)) {
    level = 'medium';
    const m = most(PRIMARY_METRICS, s.amberMinutes, rules.mediumAmberMin) ?? most(SECONDARY_METRICS, s.redMinutes, 1)!;
    worst = peakWorst(m);
  } else {
    level = 'low';
    const allGreen = METRIC_IDS.every(m => f.metrics[m].steps.every(st => st.pressure === null || st.pressure === 'green'));
    const top = allGreen ? undefined : topPeaks(f, settings, 1)[0];
    worst = top ? { metric: top.metric, value: top.value, atMin: top.atMin } : null;
  }

  const phrase = worst === null ? 'No metric goes above green'
    : leftBehindReason ? `About ${Math.round(worst.value)} students left behind after the last bus at ${clock12(worst.atMin)}`
      : PHRASES[worst.metric](worst.value, worst.atMin);

  let reason = phrase;
  const dayType = f.context.dayType;
  if (dayType === 'weekend') {
    reason = `Weekend (no shuttle, ${s.learningDisruption.sessionsScheduled} sessions): ${phrase}`;
  } else if (dayType === 'no_class') {
    reason = level === 'low' ? 'No classes today' : `No classes today, but ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;
  }
  return { level, reason, worst };
}
