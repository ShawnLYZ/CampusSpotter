import { describe, expect, it } from 'vitest';
import type { InputBundle } from '@engine/index.ts';
import { assembleBundle, fetchBundleRows, memoryRowsClient } from '@bundle/assemble.ts';
import { fixtureTables } from '@fixtures/rows/index.ts';
import { buildChecklist } from '@plans/checklist.ts';
import { REPLAY_PLAN_4NOV } from '@plans/replayPlan.ts';
import type { PlanProposal } from '../../providers/types.ts';
import { announcementScripted } from './announcement.ts';

async function bundleFor(date: string): Promise<InputBundle> {
  return assembleBundle(await fetchBundleRows(memoryRowsClient(structuredClone(fixtureTables)), date));
}

describe('announcementScripted', () => {
  it('is under 150 words and has the fixed opening and closing', async () => {
    const bundle = await bundleFor('2026-11-04');
    const plan = { levers: REPLAY_PLAN_4NOV } as PlanProposal;
    const text = announcementScripted(plan, { date: '2026-11-04' }, 'Concert', buildChecklist(REPLAY_PLAN_4NOV, bundle));
    expect(text.split(/\s+/).length).toBeLessThan(150);
    expect(text.startsWith('Dear students,')).toBe(true);
    expect(text.endsWith('Thank you for planning ahead. — APU Management')).toBe(true);
    expect(text).toContain('All classes from 10:45 AM will run online.');
  });

  it('uses the real outlet and hall names from the checklist', async () => {
    const bundle = await bundleFor('2026-11-04');
    const text = announcementScripted({ levers: REPLAY_PLAN_4NOV } as PlanProposal, { date: '2026-11-04' }, null, buildChecklist(REPLAY_PLAN_4NOV, bundle));
    expect(text).toContain(`${bundle.baseline.cafeterias[0].name} will stay open until 10:00 PM.`);
    expect(text).toContain(`${bundle.baseline.waitingHalls.find((h) => h.id === 'main-hall')!.name} will be open as a cooled waiting area from 5:00 PM.`);
  });
});
