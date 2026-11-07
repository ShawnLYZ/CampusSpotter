import { describe, expect, it } from 'vitest';
import { runForecast } from '@engine/index.ts';
import { REPLAY_PLAN_4NOV } from '@plans/replayPlan.ts';
import { createDemoProvider } from '../../providers/demo/createDemoProvider.ts';

// Steps are 15 minutes from 7:00 AM: the replay plays steps 20 (12:00 PM) to 45 (6:15 PM).
const FROM = 20, TO = 45;

describe('4 Nov replay APU-stop queue', () => {
  it('goes red with no action and stays green with the plan', async () => {
    const provider = createDemoProvider({ latencyMs: [0, 0] });
    const bundle = await provider.getInputBundle({ date: '2026-11-04', disruptionId: 'weeknd-2026-11-04', reconstructed: true });
    const window = (levers: Parameters<typeof runForecast>[1]) =>
      runForecast(bundle, levers).metrics.apuStopQueue.steps.slice(FROM, TO + 1).map((s) => s.pressure);
    const noAction = window([]);
    const withPlan = window(REPLAY_PLAN_4NOV);
    expect(noAction).toContain('red');
    expect(withPlan.every((p) => p === 'green')).toBe(true);
  });
});
