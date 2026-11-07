import type { BlockId, InputBundle, Label, LeverSet, MetricId, Threshold } from './types.ts';
import type { Forecast, MetricSeries, PerBlock, PlanEvaluation, StepStatus, StepValue, Warning } from './output.ts';
import type { Series } from './series.ts';
import type { StopResult } from './queues.ts';
import { BLOCK_IDS, METRIC_IDS } from './types.ts';
import { METRIC_TITLES, METRIC_UNITS } from './output.ts';
import { STEPS, stepStartMin, STEP_MIN } from './grid.ts';
import { clock12 } from './format.ts';
import { pressureOf } from './pressure.ts';
import { mergeInputs, weakest } from './provenance.ts';
import { validateLevers } from './levers.ts';
import { computeRoad } from './road.ts';
import { computeDemand } from './demand.ts';
import { planShuttle } from './shuttle.ts';
import { computeQueues } from './queues.ts';
import { computeOccupancy } from './campus/occupancy.ts';
import { computeCafeteria } from './campus/cafeteria.ts';
import { computeWalkway } from './campus/walkway.ts';
import { computeEnergy, energyPercent } from './campus/energy.ts';
import { computeLrtCrowding } from './lrt.ts';
import { priceLevers } from './costs.ts';
import { summarize } from './summary.ts';
import { scoreRisk } from './risk.ts';
import { ENGINE_VERSION } from './version.ts';

/** The same day with no disruptions, no estimates, no weather and typical road ratios (the energy "normal"). */
export function referenceBundle(bundle: InputBundle): InputBundle {
  const b = structuredClone(bundle);
  const typical = b.baseline.typicalRoadRatio;
  b.context.disruptions = [];
  b.estimates = [];
  b.weather = null;
  b.road = {
    kind: 'typical',
    ratio: typical.value.map(v => ({ value: v, label: typical.label, sourceId: typical.sourceId })),
    googleStaticOneWayMin: b.road.googleStaticOneWayMin,
  };
  return b;
}

/** Builds steps: non-ok steps carry no value; pressure only on ok values; provenance null when value is null. */
function toSteps(values: readonly (number | null)[], status: readonly StepStatus[], labels: readonly (Label | null)[], t: Threshold): StepValue[] {
  const out: StepValue[] = [];
  for (let i = 0; i < STEPS; i++) {
    const st = status[i];
    const v = st === 'ok' ? (values[i] ?? null) : null;
    out.push({
      value: v,
      status: v === null && st === 'ok' ? 'not_enough_data' : st,
      pressure: v === null ? null : pressureOf(v, t),
      provenance: v === null ? null : (labels[i] ?? null),
    });
  }
  return out;
}

const fromSeries = (s: Series, t: Threshold): StepValue[] => toSteps(s.values, s.status, s.labels, t);

function metric(m: MetricId, steps: StepValue[], inputs: string[], detail: Record<string, number[]>): MetricSeries {
  return { metric: m, unit: METRIC_UNITS[m], steps, inputs, detail };
}

function stopMetric(m: MetricId, stop: StopResult, labels: readonly (Label | null)[], inputs: string[], t: Threshold): MetricSeries {
  return metric(m, toSteps(stop.waitMin, stop.status, labels, t), inputs,
    { queue: stop.queue, arrivals: stop.arrivals, served: stop.served, gaveUp: stop.gaveUp });
}

function missingRunWarnings(metrics: Record<MetricId, MetricSeries>): Warning[] {
  const out: Warning[] = [];
  for (const m of METRIC_IDS) {
    const steps = metrics[m].steps;
    let t = 0;
    while (t < STEPS) {
      if (steps[t].status !== 'not_enough_data') { t++; continue; }
      let e = t;
      while (e + 1 < STEPS && steps[e + 1].status === 'not_enough_data') e++;
      const from = stepStartMin(t); const to = stepStartMin(e) + STEP_MIN;
      out.push({
        code: 'not_enough_data', metric: m, fromMin: from, toMin: to,
        message: `not enough data: ${METRIC_TITLES[m].toLowerCase()} missing ${clock12(from)}–${clock12(to)}`,
      });
      t = e + 1;
    }
  }
  return out;
}

export function runForecast(bundle: InputBundle, inputLevers: LeverSet): Forecast {
  const th = bundle.settings.thresholds;

  // 1–9: main run.
  const validated = validateLevers(inputLevers, bundle);
  const levers = validated.levers;
  const road = computeRoad(bundle);
  const demand = computeDemand(bundle, levers, road);
  const shuttle = planShuttle(bundle, levers, road);
  const queues = computeQueues(bundle, levers, demand, shuttle);
  const occupancy = computeOccupancy(bundle, levers, demand, queues);
  const cafeteria = computeCafeteria(bundle, levers, demand, queues);
  const walkway = computeWalkway(bundle, demand, queues, cafeteria);
  const energy = computeEnergy(bundle, levers, demand, occupancy);

  // 10: reference energy (no levers, reference road). Its warnings are never reported.
  const ref = referenceBundle(bundle);
  const refRoad = computeRoad(ref, { reference: true });
  const refDemand = computeDemand(ref, [], refRoad);
  const refShuttle = planShuttle(ref, [], refRoad);
  const refQueues = computeQueues(ref, [], refDemand, refShuttle);
  const refOccupancy = computeOccupancy(ref, [], refDemand, refQueues);
  const refEnergy = computeEnergy(ref, [], refDemand, refOccupancy);

  // 11
  const lrt = computeLrtCrowding(bundle);

  // 12: metric series.
  const energyStatus = new Array<StepStatus>(STEPS).fill(demand.missing ? 'not_enough_data' : 'ok');
  const energyLabels = energy.labels.map((l, t) => weakest(l, refEnergy.labels[t]));
  const energyInputs = mergeInputs(energy.inputs, refEnergy.inputs);
  const energySteps = (k: readonly number[], r: readonly number[]): StepValue[] =>
    toSteps(k.map((v, t) => energyPercent(v, r[t])), energyStatus, energyLabels, th.buildingEnergy);

  const sumBlocks = (rec: Record<BlockId, number[]>, t: number) => BLOCK_IDS.reduce((a, b) => a + rec[b][t], 0);
  const idx = Array.from({ length: STEPS }, (_, t) => t);

  const rttStatus: StepStatus[] = idx.map(t =>
    shuttle.rttMin[t] === null ? 'not_enough_data'
      : !shuttle.serviceApu[t] && !shuttle.serviceLrt[t] ? 'no_service' : 'ok');

  const metrics: Record<MetricId, MetricSeries> = {
    classroomOccupancy: metric('classroomOccupancy', fromSeries(occupancy.campus, th.classroomOccupancy), occupancy.campus.inputs, {
      inClass: idx.map(t => sumBlocks(demand.inClass, t)),
      waitingIndoors: idx.map(t => sumBlocks(occupancy.indoorByBlock, t)),
      seats: idx.map(t => sumBlocks(occupancy.seatsByBlock, t)),
    }),
    cafeteriaQueue: metric('cafeteriaQueue', fromSeries(cafeteria.wait, th.cafeteriaQueue), cafeteria.wait.inputs,
      { queue: cafeteria.queue, arrivals: cafeteria.arrivals }),
    buildingEnergy: metric('buildingEnergy', energySteps(energy.kwh, refEnergy.kwh), energyInputs,
      { kwh: energy.kwh, referenceKwh: refEnergy.kwh }),
    walkwayTraffic: metric('walkwayTraffic', fromSeries(walkway.series, th.walkwayTraffic), walkway.series.inputs,
      { flowPerMin: walkway.flowPerMin }),
    apuStopQueue: stopMetric('apuStopQueue', queues.apu, queues.labels, queues.inputs, th.apuStopQueue),
    lrtStopQueue: stopMetric('lrtStopQueue', queues.lrt, queues.labels, queues.inputs, th.lrtStopQueue),
    shuttleRtt: metric('shuttleRtt', toSteps(shuttle.rttMin, rttStatus, shuttle.labels, th.shuttleRtt), shuttle.inputs, {
      departuresApuToLrt: queues.departuresApuToLrt, departuresLrtToApu: queues.departuresLrtToApu, fleet: shuttle.fleet,
    }),
    roadDelay: metric('roadDelay', toSteps(road.ratio, road.ratio.map((): StepStatus => 'ok'), road.labels, th.roadDelay), road.inputs, {}),
    lrtCrowding: metric('lrtCrowding', fromSeries(lrt.series, th.lrtCrowding), lrt.series.inputs,
      { normalFlow: lrt.normalFlow, eventFlow: lrt.eventFlow }),
  };

  const perBlock = {} as Record<BlockId, PerBlock>;
  for (const b of BLOCK_IDS) {
    perBlock[b] = {
      occupancy: fromSeries(occupancy.perBlock[b], th.classroomOccupancy),
      energy: energySteps(energy.perBlockKwh[b], refEnergy.perBlockKwh[b]),
      energyKwh: energy.perBlockKwh[b],
    };
  }

  // 13–14
  const costLines = priceLevers(levers, bundle, {
    hallKwh: energy.hallKwh, acSavedKwh: energy.acSavedKwh, precoolKwh: energy.precoolKwh,
    hallKwhByHall: energy.hallKwhByHall, acSavedByBlock: energy.acSavedByBlock, precoolByBlock: energy.precoolByBlock,
    sessionsMoved: demand.sessionsMoved, sessionsScheduled: demand.sessionsScheduled,
  });
  const summary = summarize({ bundle, metrics, demand, shuttle, queues, kwh: energy.kwh, referenceKwh: refEnergy.kwh, costLines });

  // 16: warnings (main run only).
  const warnings: Warning[] = [
    ...validated.warnings, ...road.warnings, ...demand.warnings, ...queues.warnings, ...lrt.warnings,
  ];
  if (bundle.context.reconstructed) {
    warnings.push({ code: 'reconstructed', message: 'Inputs for this date are reconstructed from archived sources, not live data.' });
  }
  if (bundle.timetable?.label === 'baseline') {
    warnings.push({ code: 'timetable_fallback', message: 'No timetable for this date; a typical week timetable is used.', metric: 'classroomOccupancy' });
  }
  warnings.push(...missingRunWarnings(metrics));

  const f: Forecast = {
    engineVersion: ENGINE_VERSION, context: bundle.context, levers,
    metrics, perBlock, summary, risk: null, warnings,
  };
  // 15
  if (inputLevers.length === 0) f.risk = scoreRisk(f, bundle.settings);
  return f;
}

export function compareScenarios(bundle: InputBundle, levers: LeverSet): { noAction: Forecast; withPlan: Forecast } {
  return { noAction: runForecast(bundle, []), withPlan: runForecast(bundle, levers) };
}

export function evaluatePlan(bundle: InputBundle, levers: LeverSet, budgetRm: number): PlanEvaluation {
  const { noAction, withPlan } = compareScenarios(bundle, levers);
  return { noAction, withPlan, overBudget: withPlan.summary.totalCostRm > budgetRm };
}
