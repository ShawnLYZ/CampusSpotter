import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LEVER_CATALOGUE, addDays, runForecast, validateLevers } from '@engine/index.ts';
import { buildChecklist } from '@plans/checklist.ts';
import { csvTemplate, rowsToCsv } from '@bundle/csv.ts';
import type { DataProvider } from './DataProvider.ts';
import type { DisruptionInput, PlanProposal } from './types.ts';

export interface ContractSetup {
  provider: DataProvider;
  cleanup?: () => Promise<void>;
  seedScanItem: (input: DisruptionInput) => Promise<string>;
  capabilities: { roles: boolean };
}

/** Shared behaviour every DataProvider must satisfy. Part A: Early Warning. Part B (the rest) is a second describe block. */
export function providerContract(name: string, setup: () => Promise<ContractSetup>): void {
  describe(`${name} provider contract: Early Warning`, () => {
    let ctx: ContractSetup;
    let today: string;
    beforeEach(async () => {
      ctx = await setup();
      today = (await ctx.provider.getToday()).date;
    });
    afterEach(async () => { await ctx.cleanup?.(); });

    const input = (title: string, offsetDays: number, over: Partial<DisruptionInput> = {}): DisruptionInput => ({
      title: `[contract] ${title}`, type: 'manual', kind: 'other', venue: 'APU',
      startAt: `${addDays(today, offsetDays)}T09:00:00+08:00`, endAt: `${addDays(today, offsetDays)}T17:00:00+08:00`,
      expectedAttendance: 2000, notes: null, ...over,
    });
    const range = (): { from: string; to: string } => ({ from: today, to: addDays(today, 30) });

    it('creates a manual disruption with a computed risk and lists it', async () => {
      const item = await ctx.provider.createDisruption(input('Open day', 3));
      expect(item.origin).toBe('manual');
      expect(item.riskLevel).not.toBeNull();
      expect(item.daysRemaining).toBe(3);
      const list = await ctx.provider.listDisruptions(range());
      expect(list.map((i) => i.id)).toContain(item.id);
    });

    it('filters by type and risk', async () => {
      const item = await ctx.provider.createDisruption(input('Filter me', 4));
      const manual = await ctx.provider.listDisruptions({ ...range(), types: ['manual'] });
      expect(manual.length).toBeGreaterThan(0);
      expect(manual.every((i) => i.type === 'manual')).toBe(true);
      const risky = await ctx.provider.listDisruptions({ ...range(), risks: [item.riskLevel!] });
      expect(risky.map((i) => i.id)).toContain(item.id);
    });

    it('updates a manual disruption', async () => {
      const item = await ctx.provider.createDisruption(input('Before', 5));
      const updated = await ctx.provider.updateDisruption(item.id, input('After', 5));
      expect(updated.title).toBe('[contract] After');
      expect((await ctx.provider.getDisruption(item.id))?.title).toBe('[contract] After');
    });

    it('deletes a manual disruption', async () => {
      const item = await ctx.provider.createDisruption(input('Delete me', 6));
      await ctx.provider.deleteDisruption(item.id);
      expect((await ctx.provider.listDisruptions(range())).map((i) => i.id)).not.toContain(item.id);
      expect(await ctx.provider.getDisruption(item.id)).toBeNull();
    });

    it('overrides a scan item but refuses to update it', async () => {
      const id = await ctx.seedScanItem(input('Scanned', 7, { type: 'stadium_event', kind: 'concert' }));
      const overridden = await ctx.provider.overrideDisruption(id, { expectedAttendance: 9999 });
      expect(overridden.override?.expectedAttendance).toBe(9999);
      expect(overridden.expectedAttendance).toBe(9999);
      await expect(ctx.provider.updateDisruption(id, input('Nope', 7))).rejects.toThrow();
    });

    it('dismisses a scan item, hiding it unless includeDismissed', async () => {
      const id = await ctx.seedScanItem(input('Dismiss me', 8, { type: 'stadium_event', kind: 'concert' }));
      await ctx.provider.dismissDisruption(id);
      expect((await ctx.provider.listDisruptions(range())).map((i) => i.id)).not.toContain(id);
      const all = await ctx.provider.listDisruptions({ ...range(), includeDismissed: true });
      expect(all.find((i) => i.id === id)?.status).toBe('dismissed');
    });

    it('records a scan run and returns it as the latest', async () => {
      const run = await ctx.provider.triggerScan();
      expect(['success', 'failed']).toContain(run.status);
      expect((await ctx.provider.getLatestScan())?.id).toBe(run.id);
    });

    it('notifies disruption subscribers on writes', async () => {
      let calls = 0;
      const off = ctx.provider.subscribe('disruptions', () => { calls++; });
      await ctx.provider.createDisruption(input('Notify', 9));
      await expect.poll(() => calls, { timeout: 3000 }).toBeGreaterThan(0);
      off();
    });
  });

  describe(`${name} provider contract: planning, decisions, data`, () => {
    let ctx: ContractSetup;
    beforeEach(async () => { ctx = await setup(); });
    afterEach(async () => { await ctx.cleanup?.(); });

    const c4 = { date: '2026-11-04' };
    const plansFor4Nov = async (): Promise<PlanProposal[]> => ctx.provider.generatePlans(c4, 2000);
    const decide = async (): Promise<{ plan: PlanProposal; id: string }> => {
      const plan = (await plansFor4Nov())[0];
      const made = await ctx.provider.createDecision({ plan, ctx: c4, notes: '[contract] decision', announcementText: 'Dear students,' });
      return { plan, id: made.decision.id };
    };

    it('builds a full-day bundle that forecasts 76 steps for every metric', async () => {
      const b = await ctx.provider.getInputBundle({ date: '2026-11-18' });
      const f = runForecast(b, []);
      for (const series of Object.values(f.metrics)) expect(series.steps).toHaveLength(76);
    });

    it('answers a scripted question with levers that validate cleanly', async () => {
      const r = await ctx.provider.ask('What if we move afternoon classes online and add one bus?', c4, []);
      expect(r.matched).toBe(true);
      const b = await ctx.provider.getInputBundle(c4);
      expect(validateLevers(r.levers, b).warnings).toEqual([]);
    });

    it('keeps the levers for a question it cannot match', async () => {
      const r = await ctx.provider.ask('zzz qqq', c4, []);
      expect(r.matched).toBe(false);
      expect(r.changedKinds).toEqual([]);
    });

    it('generates exactly three costed plans with budget flags', async () => {
      const plans = await plansFor4Nov();
      expect(plans).toHaveLength(3);
      for (const p of plans) {
        expect(p.overBudget).toBe(p.totalCostRm > 2000);
        expect(p.costLines.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('creates a decision whose checklist covers the teams of its levers', async () => {
      const plan = (await plansFor4Nov())[0];
      const made = await ctx.provider.createDecision({ plan, ctx: c4, notes: '[contract] decision', announcementText: 'Dear students,' });
      const b = await ctx.provider.getInputBundle(c4);
      const expected = new Set(plan.levers
        .filter((l) => buildChecklist([l], b).length > 0)
        .map((l) => LEVER_CATALOGUE.find((s) => s.kind === l.kind)!.team));
      expect(new Set(made.checklist.map((i) => i.team))).toEqual(expected);
      expect((await ctx.provider.listDecisions())[0].id).toBe(made.decision.id);
    });

    it('updates a decision', async () => {
      const { id } = await decide();
      const updated = await ctx.provider.updateDecision(id, { status: 'done', notes: '[contract] ok' });
      expect(updated.status).toBe('done');
      const read = (await ctx.provider.getDecision(id))!.decision;
      expect(read.status).toBe('done');
      expect(read.notes).toBe('[contract] ok');
    });

    it('marks a checklist item done', async () => {
      const { id } = await decide();
      const full = (await ctx.provider.getDecision(id))!;
      const item = await ctx.provider.setChecklistItemDone(full.checklist[0].id, true);
      expect(item.done).toBe(true);
      expect((await ctx.provider.getDecision(id))!.checklist[0].done).toBe(true);
    });

    it('stores an edited announcement', async () => {
      const { id } = await decide();
      const a = (await ctx.provider.getDecision(id))!.announcement;
      expect((await ctx.provider.updateAnnouncement(a.id, 'Edited text')).editedText).toBe('Edited text');
      expect((await ctx.provider.getDecision(id))!.announcement.editedText).toBe('Edited text');
    });

    it('returns a recomputed forecast with a decision', async () => {
      const { id } = await decide();
      expect((await ctx.provider.getDecision(id))!.forecast).not.toBeNull();
    });

    it('lists at least ten labelled sources', async () => {
      const sources = await ctx.provider.listSources();
      expect(sources.length).toBeGreaterThanOrEqual(10);
      expect(sources.every((s) => s.label)).toBe(true);
    });

    it('lists the five baseline tables and a template starting with the header', async () => {
      expect(await ctx.provider.listBaselineTables()).toHaveLength(5);
      expect((await ctx.provider.getCsvTemplate('rooms')).startsWith('code,block,level,room_type,seats')).toBe(true);
    });

    it('rejects a bad rooms CSV with row-numbered errors', async () => {
      const r = await ctx.provider.uploadBaselineCsv('rooms', `${csvTemplate('rooms')}A-01,Z,01,classroom,40\n`, { markVerified: false });
      expect(r.ok).toBe(false);
      expect(r.applied).toBe(false);
      expect(r.errors[0].row).toBe(2);
    });

    it('applies a good energy CSV and reflects it in the next bundle', async () => {
      if (ctx.capabilities.roles) return;
      const energy = (await ctx.provider.listBaselineTables()).find((t) => t.name === 'energy_profiles')!;
      const rows = energy.rows.map((r) => ({ ...r, base_load_kw: (r.base_load_kw as number) + 10 }));
      const before = (await ctx.provider.getInputBundle({ date: '2026-11-18' })).baseline.energy.A.baseLoadKw.value;
      const r = await ctx.provider.uploadBaselineCsv('energy_profiles', rowsToCsv('energy_profiles', rows), { markVerified: true });
      expect(r.applied).toBe(true);
      const after = await ctx.provider.getInputBundle({ date: '2026-11-18' });
      expect(after.baseline.energy.A.baseLoadKw.value).toBe(before + 10);
      expect(after.baseline.energy.A.baseLoadKw.label).toBe('verified');
    });

    it('returns the 4 Nov station day, or null when the provider has no data', async () => {
      const day = await ctx.provider.getStationDay('2026-11-04');
      if (day !== null) expect(day).toMatchObject({ boardings: 24238, alightings: 33804 });
    });

    it('returns settings, estimates and the signed-in user', async () => {
      expect((await ctx.provider.getSettings()).defaultBudgetRm.value).toBeGreaterThan(0);
      expect((await ctx.provider.listEstimates()).every((e) => e.disruptionTitle !== '')).toBe(true);
      expect((await ctx.provider.currentUser())?.role).toBe('manager');
    });
  });
}
