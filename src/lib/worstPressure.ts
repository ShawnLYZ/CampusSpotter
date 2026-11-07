import { METRIC_IDS } from '@engine/index.ts';
import type { Forecast, MetricId, Pressure } from '@engine/index.ts';

const RANK: Record<Pressure, number> = { green: 0, amber: 1, red: 2 };

/** The worst pressure across the given metrics at every step (null where no metric has a pressure). */
export function worstPressureByStep(fc: Forecast, metrics: readonly MetricId[] = METRIC_IDS): (Pressure | null)[] {
  const n = fc.metrics[metrics[0]].steps.length;
  return Array.from({ length: n }, (_, i) => {
    let worst: Pressure | null = null;
    for (const m of metrics) {
      const p = fc.metrics[m].steps[i]?.pressure ?? null;
      if (p && (worst === null || RANK[p] > RANK[worst])) worst = p;
    }
    return worst;
  });
}
