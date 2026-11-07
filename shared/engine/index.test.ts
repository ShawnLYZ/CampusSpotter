import { describe, expect, it } from 'vitest';
import * as engine from './index.ts';
import type { TopPeak } from './index.ts';

describe('M5: public exports', () => {
  it('exports the runtime constants and energyPercent', () => {
    expect(engine.METRIC_IDS).toHaveLength(9);
    expect(engine.PRIMARY_METRICS).toContain('apuStopQueue');
    expect(engine.SECONDARY_METRICS).toEqual(['roadDelay', 'lrtCrowding']);
    expect(engine.BLOCK_IDS).toContain('A');
    expect(engine.ROOM_TYPES).toEqual(['classroom', 'lab', 'auditorium']);
    expect(engine.energyPercent(110, 100)).toBeCloseTo(10, 10);
    expect(engine.STEP_HOURS).toBe(0.25);
    const p: TopPeak = { metric: 'apuStopQueue', value: 1, atMin: 420, pressure: 'red' };
    expect(p.metric).toBe('apuStopQueue');
  });
});
