import type { InputBundle, Label } from '../types.ts';
import type { StepStatus } from '../output.ts';
import type { Demand } from '../demand.ts';
import type { QueueResult } from '../queues.ts';
import type { CafeteriaResult } from './cafeteria.ts';
import type { Series } from '../series.ts';
import { STEPS, zeros } from '../grid.ts';
import { makeSeries } from '../series.ts';
import { mergeInputs, weakest } from '../provenance.ts';

export function computeWalkway(
  bundle: InputBundle, demand: Demand, queues: QueueResult, cafeteria: CafeteriaResult,
): { series: Series; flowPerMin: number[] } {
  const cap = bundle.baseline.walkwayCapacityPerMin;
  const cafeUsed = cafeteria.arrivals.some(v => v > 0);
  const inputs = mergeInputs(demand.inputs, queues.inputs, ['baseline:walkwayCapacityPerMin'],
    cafeUsed ? cafeteria.wait.inputs : []);
  const flowPerMin = zeros();

  if (demand.missing) {
    return {
      series: makeSeries(
        new Array<number | null>(STEPS).fill(null), null, inputs,
        new Array<StepStatus>(STEPS).fill('not_enough_data'),
      ),
      flowPerMin,
    };
  }

  const values = new Array<number | null>(STEPS).fill(null);
  const labels = new Array<Label | null>(STEPS).fill(null);
  for (let t = 0; t < STEPS; t++) {
    const apu = queues.apu.arrivals[t];
    flowPerMin[t] = (demand.endersSpread[t] + demand.startersSpread[t] + apu + cafeteria.arrivals[t]
      + demand.prayerOut[t] + demand.prayerBack[t]) / 15;
    values[t] = flowPerMin[t] / cap.value * 100;
    labels[t] = weakest(demand.label, apu > 0 ? queues.labels[t] : null, cap.label,
      cafeteria.arrivals[t] > 0 ? cafeteria.wait.labels[t] : null);
  }
  return { series: makeSeries(values, labels, inputs), flowPerMin };
}
