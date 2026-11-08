import { describe, expect, it } from 'vitest';
import { runForecast } from '@engine/index.ts';
import { assembleBundle, fetchBundleRows, memoryRowsClient } from '@bundle/assemble.ts';
import { fixtureTables } from '@fixtures/rows/index.ts';
import { REPLAY_PLAN_4NOV } from '@plans/replayPlan.ts';

// Steps are 15 minutes from 7:00 AM: the replay plays steps 20 (12:00 PM) to 45 (6:15 PM).
const FROM = 20, TO = 45;

describe('4 Nov replay APU-stop queue', () => {
  it('goes red with no action and stays green with the plan', async () => {
    const bundle = assembleBundle(await fetchBundleRows(memoryRowsClient(structuredClone(fixtureTables)), '2026-11-04'), { reconstructed: true });
    const window = (levers: Parameters<typeof runForecast>[1]) =>
      runForecast(bundle, levers).metrics.apuStopQueue.steps.slice(FROM, TO + 1).map((s) => s.pressure);
    const noAction = window([]);
    const withPlan = window(REPLAY_PLAN_4NOV);
    expect(noAction).toContain('red');
    expect(withPlan.every((p) => p === 'green')).toBe(true);
  });
});
