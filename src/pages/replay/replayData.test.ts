import { describe, expect, it } from 'vitest';
import { durationText, rmText } from '@engine/index.ts';
import type { Summary } from '@engine/index.ts';
import { createDemoProvider } from '../../providers/demo/createDemoProvider.ts';
import { MILESTONES, buildJun3Card, replayNarrative } from './replayData.ts';

const provider = () => createDemoProvider({ latencyMs: [0, 0] });
const summary = (wait: number, queue: number, cost: number): Summary => ({
  peakApuWaitMin: wait, peakApuQueue: { value: queue, atMin: 13 * 60 }, totalCostRm: cost,
}) as unknown as Summary;

describe('replay data', () => {
  it('has four milestones in date order', () => {
    expect(MILESTONES.map((m) => m.id)).toEqual(['jun3', 'oct21', 'nov3', 'nov4']);
    const dates = MILESTONES.map((m) => m.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('builds the 3 Jun card at 154 days with a high or critical risk', async () => {
    const card = await buildJun3Card(provider());
    expect(card.daysRemaining).toBe(154);
    expect(card.isPast).toBe(false);
    expect(['high', 'critical']).toContain(card.riskLevel);
  });

  it('gives the Demo provider the 4 Nov station day with typical figures', async () => {
    const day = await provider().getStationDay('2026-11-04');
    expect(day).not.toBeNull();
    expect(day).toMatchObject({ boardings: 24238, alightings: 33804 });
    expect(day!.typicalBoardings).toBeGreaterThan(0);
    expect(await provider().getStationDay('2030-01-01')).toBeNull();
  });

  it('writes a narrative whose numbers come from its inputs', () => {
    const noAction = summary(42, 1234.4, 0);
    const withPlan = summary(8, 100, 1850);
    const text = replayNarrative(noAction, withPlan, { boardings: 24238, alightings: 33804, typicalBoardings: 9876.2 });
    for (const s of ['33,804', '24,238', '9,876', durationText(42), '1,234', durationText(8), rmText(1850)]) expect(text).toContain(s);
    // Strip the fixed copy and every formatted input; no stray digits may remain.
    let rest = text;
    for (const s of ['33,804', '24,238', '9,876', durationText(42), '1,234', durationText(8), rmText(1850), '4 November', '12:00 PM', '10:45 AM', '1:00 PM']) {
      rest = rest.replace(s, '');
    }
    expect(rest).not.toMatch(/\d/);
    expect(replayNarrative(noAction, withPlan, null)).not.toContain('alightings');
  });
});
