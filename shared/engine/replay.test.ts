import { describe, it, expect } from 'vitest';
import { compareScenarios, runForecast } from './forecast.ts';
import { REPLAY_PLAN_4NOV } from '../plans/replayPlan.ts';
import { concert4Nov } from '../fixtures/engine/index.ts';

describe('4 Nov replay acceptance (D6)', () => {
  it('4 Nov with no action is Critical with an APU-stop peak of ~400 around 6 pm', async () => {
    const f = runForecast(await concert4Nov(), []);
    expect(f.risk!.level).toBe('critical');
    expect(f.summary.peakApuQueue.value!).toBeGreaterThanOrEqual(340); expect(f.summary.peakApuQueue.value!).toBeLessThanOrEqual(460);
    expect(f.summary.peakApuQueue.atMin!).toBeGreaterThanOrEqual(1050); expect(f.summary.peakApuQueue.atMin!).toBeLessThanOrEqual(1110);
    expect(f.summary.peakApuWaitMin!).toBeGreaterThan(120);
  });
  it('the CampusSpotter plan cuts peak APU wait by at least 70% for at most RM 2,000', async () => {
    const { noAction, withPlan } = compareScenarios(await concert4Nov(), REPLAY_PLAN_4NOV);
    expect(withPlan.summary.peakApuWaitMin!).toBeLessThanOrEqual(0.3 * noAction.summary.peakApuWaitMin!);
    expect(withPlan.summary.totalCostRm).toBeLessThanOrEqual(2000);
    expect(withPlan.summary.learningDisruption.sessionsMoved).toBe(413);
  });
});
