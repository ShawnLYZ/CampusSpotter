import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataProvider } from '../../src/providers/DataProvider.ts';

export interface CleanupCounts { disruptions: number; decisions: number; plans: number; forecasts: number }

/** Ids of plans and forecasts a test run created, so cleanup removes exactly those. */
export interface Tracker { plans: Set<string>; forecasts: Set<string> }
export const newTracker = (): Tracker => ({ plans: new Set(), forecasts: new Set() });

/** Wraps the provider methods that persist plans and forecasts so their ids are recorded. */
export function track(provider: DataProvider, t: Tracker): DataProvider {
  return {
    ...provider,
    async generatePlans(ctx, budgetRm) {
      const plans = await provider.generatePlans(ctx, budgetRm);
      for (const p of plans) t.plans.add(p.id);
      return plans;
    },
    async saveForecast(ctx, levers) {
      const f = await provider.saveForecast(ctx, levers);
      t.forecasts.add(f.id);
      return f;
    },
    async createDecision(input) {
      const made = await provider.createDecision(input);
      if (made.decision.planId) t.plans.add(made.decision.planId);
      if (made.decision.forecastId) t.forecasts.add(made.decision.forecastId);
      return made;
    },
  };
}

async function deleteUnreferenced(admin: SupabaseClient, table: 'plans' | 'forecasts', column: 'plan_id' | 'forecast_id', ids: Set<string>): Promise<number> {
  if (ids.size === 0) return 0;
  const refs = await admin.from('decisions').select(column);
  if (refs.error) throw new Error(`cleanup refs: ${refs.error.message}`);
  const used = new Set((refs.data ?? []).map((r) => (r as unknown as Record<string, string | null>)[column]));
  const free = [...ids].filter((id) => !used.has(id));
  let n = 0;
  for (let i = 0; i < free.length; i += 100) {
    const { data, error } = await admin.from(table).delete().in('id', free.slice(i, i + 100)).select('id');
    if (error) throw new Error(`cleanup ${table}: ${error.message}`);
    n += data?.length ?? 0;
  }
  return n;
}

/**
 * Removes only rows the live tests create: disruptions tagged `[contract]` or with a `test-` id, decisions whose notes start
 * with `[contract]`, and the plans and forecasts those decisions referenced or this run tracked (only when no remaining decision uses them).
 */
export async function cleanupContractRows(admin: SupabaseClient, tracker: Tracker = newTracker()): Promise<CleanupCounts> {
  const d1 = await admin.from('disruptions').delete().or('title.like.[contract]%,id.like.test-%').select('id');
  if (d1.error) throw new Error(`cleanup disruptions: ${d1.error.message}`);

  const plans = new Set(tracker.plans);
  const forecasts = new Set(tracker.forecasts);
  const tagged = await admin.from('decisions').select('id, plan_id, forecast_id').like('notes', '[contract]%');
  if (tagged.error) throw new Error(`cleanup decisions: ${tagged.error.message}`);
  for (const r of tagged.data ?? []) {
    if (r.plan_id) plans.add(r.plan_id as string);
    if (r.forecast_id) forecasts.add(r.forecast_id as string);
  }
  let decisions = 0;
  const ids = (tagged.data ?? []).map((r) => r.id as string);
  if (ids.length > 0) {
    const del = await admin.from('decisions').delete().in('id', ids).select('id');
    if (del.error) throw new Error(`cleanup decisions: ${del.error.message}`);
    decisions = del.data?.length ?? 0;
  }
  return {
    disruptions: d1.data?.length ?? 0,
    decisions,
    plans: await deleteUnreferenced(admin, 'plans', 'plan_id', plans),
    forecasts: await deleteUnreferenced(admin, 'forecasts', 'forecast_id', forecasts),
  };
}
