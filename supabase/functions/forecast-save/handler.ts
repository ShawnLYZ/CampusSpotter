import { assembleBundle, fetchBundleRows } from '../_shared/bundle.ts';
import type { ContextRequest } from '../_shared/api.ts';
import type { LeverSet } from '../_shared/engine.ts';
import { saveForecast } from '../_shared/forecastRow.ts';
import { HttpError, json, readJson } from '../_shared/http.ts';
import type { Repo } from '../_shared/repo.ts';
import { serveRequest } from '../_shared/request.ts';

export interface PersistDeps { repo: Repo; now: () => Date }
interface Body { context?: Partial<ContextRequest>; levers?: unknown }

export function handle(req: Request, deps: PersistDeps): Promise<Response> {
  return serveRequest(req, deps.repo, async (caller) => {
    const { context, levers } = (await readJson<Body>(req)) ?? {};
    if (!context || typeof context.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(context.date)) {
      throw new HttpError(400, 'context.date (YYYY-MM-DD) is required');
    }
    if (!Array.isArray(levers)) throw new HttpError(400, 'levers must be an array');
    const bundle = assembleBundle(await fetchBundleRows(deps.repo.rows, context.date), { reconstructed: !!context.reconstructed });
    const { id } = await saveForecast(deps.repo, bundle, {
      date: context.date, disruptionId: context.disruptionId, levers: levers as LeverSet, userId: caller.userId,
    });
    return json({ id });
  });
}
