import type { Pressure, StepStatus } from '@engine/output.ts';

/** Beyond this camera distance, green and grey (no-data) labels are dropped. */
export const QUIET_LABEL_FAR = 120;
/** Pixel gap kept between two visible chips. */
export const LABEL_GAP = 4;

/** Label importance: red 3, amber 2, grey (no service / no data) 1, green 0, no label -1. */
export function labelSeverity(pressure: Pressure | null, status: StepStatus): number {
  if (status !== 'ok') return 1;
  if (pressure === 'red') return 3;
  if (pressure === 'amber') return 2;
  if (pressure === 'green') return 0;
  return -1;
}

/** Indices in placement order: the selected one first, then by severity descending, ties by index. Excludes severity < 0. */
export function labelOrder(severities: readonly number[], selected: number): number[] {
  const idx = severities.map((_, i) => i).filter((i) => severities[i] >= 0);
  return idx.sort((a, b) => {
    const ra = a === selected ? 99 : severities[a];
    const rb = b === selected ? 99 : severities[b];
    return rb - ra || a - b;
  });
}

/**
 * Greedy placement: walk `order`, show a chip only if it is a candidate (`ok`) and does not overlap an already
 * shown chip. Centres cx/cy and half sizes hw/hh are in pixels. Writes 1/0 into `visible`; allocates nothing.
 */
export function placeLabels(
  order: readonly number[], ok: Uint8Array, cx: Float32Array, cy: Float32Array,
  hw: Float32Array, hh: Float32Array, visible: Uint8Array, gap = LABEL_GAP,
): void {
  visible.fill(0);
  for (let k = 0; k < order.length; k++) {
    const i = order[k];
    if (!ok[i]) continue;
    let clash = false;
    for (let m = 0; m < k && !clash; m++) {
      const j = order[m];
      if (!visible[j]) continue;
      clash = Math.abs(cx[i] - cx[j]) < hw[i] + hw[j] + gap && Math.abs(cy[i] - cy[j]) < hh[i] + hh[j] + gap;
    }
    if (!clash) visible[i] = 1;
  }
}
