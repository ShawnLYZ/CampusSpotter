import type { Forecast, Label, MetricId } from '@engine/index.ts';
import { mergeInputs, weakest } from '@engine/provenance.ts';

export interface FigureProvenance { label: Label | null; inputs: string[] }

/** Provenance of a figure that reads these metrics: the weakest step label and the union of their inputs, over every given forecast. */
export function figureProvenance(forecasts: Forecast | readonly Forecast[], metrics: readonly MetricId[]): FigureProvenance {
  const list: readonly Forecast[] = Array.isArray(forecasts) ? forecasts : [forecasts as Forecast];
  const series = list.flatMap((f) => metrics.map((m) => f.metrics[m]));
  return {
    label: weakest(...series.flatMap((s) => s.steps.map((st) => st.provenance))),
    inputs: mergeInputs(...series.map((s) => s.inputs)),
  };
}
