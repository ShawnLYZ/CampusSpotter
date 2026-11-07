import type { InputBundle, Label, RoadSeries } from './types.ts';
import type { Warning } from './output.ts';
import { STEPS, hourIndexAtStep, interpolateHourly, stepStartMin } from './grid.ts';
import { EVENT_KINDS, estimateCurves } from './estimates.ts';
import { mergeInputs, weakest } from './provenance.ts';

export interface RoadResult {
  ratio: (number | null)[]; labels: (Label | null)[]; inputs: string[];
  dropFromMin: number | null; kind: RoadSeries['kind']; warnings: Warning[];
}

const UPLIFT_CAP = 12;

export function computeRoad(bundle: InputBundle, opts: { reference?: boolean } = {}): RoadResult {
  const reference = opts.reference === true;
  const road = bundle.road;
  const baseVals = road.ratio.map(p => (p ? p.value : null));
  const baseLabels = road.ratio.map(p => (p ? p.label : null));

  const curves = !reference && road.kind !== 'reconstructed' ? estimateCurves(bundle, 'eventRoadUplift', EVENT_KINDS) : [];
  const weather = bundle.weather;
  const useWeather = weather !== null && !reference;
  const rainFactor = bundle.baseline.rainFactor;
  const threshold = bundle.baseline.rainThresholdMmPerH.value;

  const ratio: (number | null)[] = [];
  const labels: (Label | null)[] = [];
  let rainApplied = false;

  for (let t = 0; t < STEPS; t++) {
    const base = interpolateHourly(baseVals, t);
    const h = (stepStartMin(t) - 420) / 60;
    const lo = Math.floor(h);
    const baseLabel = base === null ? null
      : h === lo ? baseLabels[lo] : weakest(baseLabels[lo], baseLabels[Math.min(lo + 1, 19)]);

    let uplift = 1;
    let hasUplift = false;
    for (const c of curves) {
      const u = interpolateHourly(c.curve, t);
      if (u === null) continue;
      uplift *= u; hasUplift = true;
    }
    uplift = Math.min(uplift, UPLIFT_CAP);

    let rain = 1;
    let rainLabel: Label | null = null;
    if (useWeather) {
      const p = weather.precipitationMm[hourIndexAtStep(t)];
      if (p && p.value >= threshold) { rain = rainFactor.value; rainLabel = rainFactor.label; rainApplied = true; }
    }

    if (base === null && !hasUplift) { ratio.push(null); labels.push(null); continue; }
    ratio.push((base ?? 1) * uplift * rain);
    labels.push(weakest(base === null ? 'ai' : baseLabel, uplift > 1 ? 'ai' : null, rainLabel));
  }

  const events = bundle.context.disruptions.filter(d => EVENT_KINDS.includes(d.kind));
  let dropFromMin: number | null = null;
  if (events.length > 0) {
    const amber = bundle.settings.thresholds.roadDelay.amberFrom;
    for (let t = 0; t < STEPS; t++) {
      const v = ratio[t];
      if (v !== null && v >= amber) { dropFromMin = stepStartMin(t); break; }
    }
    if (dropFromMin === null) dropFromMin = Math.min(...events.map(d => d.startMin));
  }

  const warnings: Warning[] = [];
  if (road.kind === 'typical' && !reference) {
    warnings.push({ code: 'traffic_assumed_typical', message: 'No live traffic data; typical road ratios are assumed.', metric: 'roadDelay' });
  }
  if (weather === null) {
    warnings.push({ code: 'weather_missing', message: 'Weather forecast unavailable; rain effect on roads ignored.', metric: 'roadDelay' });
  }

  const inputs = mergeInputs(
    [`road:${road.kind}`],
    curves.map(c => `estimate:eventRoadUplift:${c.disruptionId}`),
    useWeather ? ['weather'] : [],
    rainApplied ? ['baseline:rainFactor'] : [],
  );
  return { ratio, labels, inputs, dropFromMin, kind: road.kind, warnings };
}
