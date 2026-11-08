import type { InputBundle, LeverSet } from './engine.ts';
import { ENGINE_VERSION, runForecast } from './engine.ts';
import { canonicalJson, sha256Hex } from './hash.ts';
import type { Repo } from './repo.ts';

/** Run the engine for `levers` and store the result as a forecasts row. */
export async function saveForecast(
  repo: Repo,
  bundle: InputBundle,
  opts: { date: string; disruptionId?: string; levers: LeverSet; userId: string },
) {
  const forecast = runForecast(bundle, opts.levers);
  const { id } = await repo.insertForecast({
    context_date: opts.date,
    disruption_id: opts.disruptionId ?? null,
    scenario_kind: opts.levers.length ? 'plan' : 'no_action',
    levers: forecast.levers,
    summary: forecast.summary,
    per_step: { metrics: forecast.metrics, perBlock: forecast.perBlock },
    input_snapshot_hash: await sha256Hex(canonicalJson(bundle)),
    engine_version: ENGINE_VERSION,
    created_by: opts.userId,
  });
  return { id, forecast };
}
