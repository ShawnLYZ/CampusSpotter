import type { Label } from './types.ts';
import type { StepStatus } from './output.ts';

export interface Series { values: (number | null)[]; status: StepStatus[]; labels: (Label | null)[]; inputs: string[] }

export function makeSeries(
  values: (number | null)[],
  label: Label | null | (Label | null)[],
  inputs: string[],
  status?: StepStatus[],
): Series {
  return {
    values,
    status: status ?? values.map((v): StepStatus => (v === null ? 'not_enough_data' : 'ok')),
    labels: values.map((v, i) => (v === null ? null : Array.isArray(label) ? (label[i] ?? null) : label)),
    inputs,
  };
}
