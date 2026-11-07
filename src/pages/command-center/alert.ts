import type { RiskLevel } from '@engine/index.ts';
import type { EarlyWarningItem } from '../../providers/types.ts';

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/** Highest risk first, then earliest start. Ignores dismissed, past and unrated items. */
export function pickAlert(items: EarlyWarningItem[]): EarlyWarningItem | null {
  let best: EarlyWarningItem | null = null;
  for (const it of items) {
    if (it.status !== 'active' || it.isPast || it.riskLevel === null) continue;
    if (!best || best.riskLevel === null) { best = it; continue; }
    const r = RANK[it.riskLevel] - RANK[best.riskLevel];
    if (r > 0 || (r === 0 && it.startAt < best.startAt)) best = it;
  }
  return best;
}
