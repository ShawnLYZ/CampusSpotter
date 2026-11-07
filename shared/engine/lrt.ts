import type { InputBundle, Label } from './types.ts';
import type { StepStatus, Warning } from './output.ts';
import type { Series } from './series.ts';
import { EVENT_KINDS } from './estimates.ts';
import { STEPS, hourIndexAtStep, zeros } from './grid.ts';
import { mergeInputs, weakest } from './provenance.ts';

export function computeLrtCrowding(bundle: InputBundle): { series: Series; normalFlow: number[]; eventFlow: number[]; warnings: Warning[] } {
  const normalFlow = zeros(STEPS);
  const eventFlow = zeros(STEPS);
  const warnings: Warning[] = [];
  const rid = bundle.ridership;
  const profile = bundle.baseline.lrtHourlyProfile;
  const baseInputs = ['ridership', 'baseline:lrtHourlyProfile'];

  if (!rid) {
    return {
      series: {
        values: new Array(STEPS).fill(null), status: new Array<StepStatus>(STEPS).fill('not_enough_data'),
        labels: new Array(STEPS).fill(null), inputs: baseInputs,
      },
      normalFlow, eventFlow, warnings,
    };
  }

  const daily = rid.typicalDailyBoardings.value + rid.typicalDailyAlightings.value;
  for (let i = 0; i < STEPS; i++) normalFlow[i] = daily * (profile.value[hourIndexAtStep(i)] ?? 0) / 4;

  const inputs = [...baseInputs];
  for (const d of bundle.context.disruptions) {
    if (!EVENT_KINDS.includes(d.kind)) continue;
    const find = (key: string) => bundle.estimates.find(e => e.key === key && e.disruptionId === d.id);
    const share = find('eventLrtModeShare');
    const arr = find('eventArrivalCurve');
    const dep = find('eventDepartureCurve');
    const attendance = d.expectedAttendance?.value;
    const missing: string[] = [];
    if (attendance == null) missing.push('attendance');
    if (!share || typeof share.likely !== 'number') missing.push('LRT mode share');
    if (!arr || !Array.isArray(arr.likely)) missing.push('arrival curve');
    if (!dep || !Array.isArray(dep.likely)) missing.push('departure curve');
    if (missing.length > 0) {
      warnings.push({ code: 'estimate_missing', metric: 'lrtCrowding', message: `${d.title}: missing ${missing.join(', ')} for LRT crowding; event flow ignored.` });
      continue;
    }
    const a = arr!.likely as number[];
    const p = dep!.likely as number[];
    const s = share!.likely as number;
    for (let i = 0; i < STEPS; i++) {
      const h = hourIndexAtStep(i);
      eventFlow[i] += attendance! * s * ((a[h] ?? 0) + (p[h] ?? 0)) / 4;
    }
    inputs.push(`estimate:eventLrtModeShare:${d.id}`, `estimate:eventArrivalCurve:${d.id}`, `estimate:eventDepartureCurve:${d.id}`);
  }

  const values: (number | null)[] = [];
  const status: StepStatus[] = [];
  const labels: (Label | null)[] = [];
  const base = weakest(rid.typicalDailyBoardings.label, rid.typicalDailyAlightings.label, profile.label);
  // Late at night normal flow is near zero, so dividing by it gives meaningless ratios (300×+).
  // Compare event flow against at least an average hour of the day (daily ÷ 24, per 15-min step).
  const floor = daily / 24 / 4;
  for (let i = 0; i < STEPS; i++) {
    if (normalFlow[i] === 0) { values.push(null); status.push('no_service'); labels.push(null); continue; }
    values.push(1 + eventFlow[i] / Math.max(normalFlow[i], floor));
    status.push('ok');
    labels.push(eventFlow[i] > 0 ? weakest(base, 'ai') : base);
  }
  return { series: { values, status, labels, inputs: mergeInputs(inputs) }, normalFlow, eventFlow, warnings };
}
