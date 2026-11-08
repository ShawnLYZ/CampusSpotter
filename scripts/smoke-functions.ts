// Live smoke test of the deployed Edge Functions, as the demo user. Cleans up what it created (decision, forecasts, plans).
// Run: node --env-file=.env --env-file=.env.local scripts/smoke-functions.ts
import { isDeepStrictEqual } from 'node:util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assembleBundle, fetchBundleRows } from '../shared/bundle/assemble.ts';
import type { RowFilter, RowsClient } from '../shared/bundle/assemble.ts';
import type { TableName } from '../shared/bundle/rows.ts';
import { evaluatePlan } from '../shared/engine/index.ts';
import { buildChecklist } from '../shared/plans/checklist.ts';
import { project, publishableKey, secretKey } from './lib/project.ts';

const URL_ = project().url;
const PUBLISHABLE_KEY = publishableKey();
const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error(`${n} is not set`);
  return v;
};

const pub = createClient(URL_, PUBLISHABLE_KEY, { auth: { persistSession: false } });
const admin = createClient(URL_, await secretKey(), { auth: { persistSession: false } });

function rowsClient(c: SupabaseClient): RowsClient {
  return {
    async select(table: TableName, filters: RowFilter[] = []) {
      let q = c.from(table).select('*');
      for (const f of filters) {
        const v = f.value as never;
        if (f.op === 'in') q = q.in(f.column, v);
        else q = (q as unknown as Record<string, (c: string, x: unknown) => typeof q>)[f.op](f.column, v);
      }
      const { data, error } = await q;
      if (error) throw new Error(`select ${table}: ${error.message}`);
      return data ?? [];
    },
  };
}

let jwt = '';
const failures: string[] = [];
const timings: string[] = [];
const forecastIds = new Set<string>();
const decisionIds = new Set<string>();
const planIds = new Set<string>();

async function call<T>(fn: string, body: unknown): Promise<T> {
  const t0 = Date.now();
  const res = await fetch(`${URL_}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}`, apikey: PUBLISHABLE_KEY },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const text = await res.text();
  let data: unknown = null;
  try { data = JSON.parse(text); } catch { /* non-JSON */ }
  const cached = (data as { cached?: boolean } | null)?.cached;
  const line = `${fn}: ${res.status}, ${ms}ms${cached === undefined ? '' : cached ? ', cached' : ', fresh'}`;
  console.log(line);
  timings.push(line);
  if (!res.ok) {
    failures.push(fn);
    console.log(`  error body: ${text.slice(0, 400)}`);
    throw new Error(`${fn} returned ${res.status}`);
  }
  return data as T;
}

async function main() {
  const { data: auth, error } = await pub.auth.signInWithPassword({ email: need('VITE_DEMO_EMAIL'), password: need('VITE_DEMO_PASSWORD') });
  if (error || !auth.session) throw new Error(`demo sign-in failed: ${error?.message}`);
  jwt = auth.session.access_token;
  console.log('signed in as demo user');

  const date4 = '2026-11-04';
  const ctx4 = { date: date4, disruptionId: 'weeknd-2026-11-04', reconstructed: true };
  const ctx18 = { date: '2026-11-18' };

  await call('ai-estimate', { date: date4, disruptionId: 'weeknd-2026-11-04' });

  const askBody = { question: 'What if we move afternoon classes online and add one bus?', context: ctx18, levers: [] };
  const ask = await call<{ levers: unknown[] }>('ai-ask', askBody);

  // Local engine run for the explain summaries.
  const bundle18 = assembleBundle(await fetchBundleRows(rowsClient(admin), ctx18.date));
  const ev = evaluatePlan(bundle18, ask.levers as never, 2000);
  await call('ai-explain', { context: ctx18, levers: ask.levers, noAction: ev.noAction.summary, withPlan: ev.withPlan.summary });

  const { plans } = await call<{ plans: Array<{ id: string; levers: never }> }>('ai-plans', { context: ctx4, budgetRm: 2000 });
  for (const p of plans) planIds.add(p.id);
  const plan = plans[0];
  const bundle4 = assembleBundle(await fetchBundleRows(rowsClient(admin), date4), { reconstructed: true });
  const checklist = buildChecklist(plan.levers, bundle4);
  const { draft } = await call<{ draft: string }>('ai-announcement', { plan, context: ctx4, checklist });

  const saved = await call<{ id: string }>('forecast-save', { context: ctx4, levers: plan.levers });
  forecastIds.add(saved.id);
  const made = await call<{ decision: { id: string; forecastId: string | null } }>('decision-create', {
    planId: plan.id, context: ctx4, notes: '[smoke]', announcementText: draft,
  });
  decisionIds.add(made.decision.id);
  if (made.decision.forecastId) forecastIds.add(made.decision.forecastId);

  // ai-ask returns no cached flag: a cache hit returns the identical stored response (jsonb reorders keys, so compare deeply).
  const again = await call<unknown>('ai-ask', askBody);
  const identical = isDeepStrictEqual(again, ask);
  console.log(`ai-ask repeat: identical=${identical}`);
  if (!identical) failures.push('ai-ask second call not identical (not served from cache)');
}

async function cleanup() {
  // Delete exactly what this run created, by id: the decision (cascades to checklist and announcement), then its forecasts and the plans it was made from.
  const remove = async (table: string, ids: Set<string>) => {
    if (ids.size === 0) return;
    const { error } = await admin.from(table).delete().in('id', [...ids]);
    if (error) throw new Error(`delete ${table}: ${error.message}`);
  };
  await remove('decisions', decisionIds);
  await remove('forecasts', forecastIds);
  await remove('plans', planIds);
  console.log(`cleanup: removed ${decisionIds.size} decision(s), ${forecastIds.size} forecast(s), ${planIds.size} plan(s)`);
}

try {
  await main();
} catch (e) {
  console.log(`smoke failed: ${e instanceof Error ? e.message : 'unknown error'}`);
  failures.push('exception');
} finally {
  try { await cleanup(); } catch (e) { console.log(`cleanup failed: ${e instanceof Error ? e.message : 'unknown'}`); failures.push('cleanup'); }
}
if (failures.length) process.exit(1);
console.log('smoke ok');
