import { describe, expect, it } from 'vitest';
import type { LeverSet } from '@engine/index.ts';
import { concert4Nov } from '@fixtures/engine/index.ts';
import { buildChecklist } from '@plans/checklist.ts';
import { REPLAY_PLAN_4NOV } from '@plans/replayPlan.ts';
import { replayAnnouncement } from './replayAnnouncement.ts';

describe('replayAnnouncement', () => {
  it('is under 150 words and has the fixed opening and closing', async () => {
    const bundle = await concert4Nov();
    const text = replayAnnouncement(REPLAY_PLAN_4NOV, buildChecklist(REPLAY_PLAN_4NOV, bundle));
    expect(text.split(/\s+/).length).toBeLessThan(150);
    expect(text.startsWith('Dear students,')).toBe(true);
    expect(text.endsWith('Thank you for planning ahead. — APU Management')).toBe(true);
    expect(text).toContain('All classes from 10:45 AM will run online.');
  });

  it('uses the real outlet and hall names from the checklist', async () => {
    const bundle = await concert4Nov();
    const levers: LeverSet = [
      { kind: 'cafeteria', outletId: 'main', extraCounters: 0, fromMin: 1080, toMin: 1320, closeAtMin: 1320 },
      { kind: 'waitingHall', hallId: 'main-hall', fromMin: 1020, toMin: 1320 },
    ];
    const text = replayAnnouncement(levers, buildChecklist(levers, bundle));
    expect(text).toContain(`${bundle.baseline.cafeterias[0].name} will stay open until 10:00 PM.`);
    expect(text).toContain(`${bundle.baseline.waitingHalls.find((h) => h.id === 'main-hall')!.name} will be open as a cooled waiting area from 5:00 PM.`);
  });
});
