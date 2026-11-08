import { estimateForDisruption, toEstimate } from '../_shared/estimate.ts';
import type { AiDeps } from '../_shared/estimate.ts';
import { GeminiError } from '../_shared/gemini.ts';
import { fail, HttpError, json, readJson } from '../_shared/http.ts';
import { serveRequest } from '../_shared/request.ts';

export function handle(req: Request, deps: AiDeps): Promise<Response> {
  return serveRequest(req, deps.repo, async () => {
    const body = await readJson<{ date?: unknown; disruptionId?: unknown }>(req);
    const { date, disruptionId } = body ?? {};
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof disruptionId !== 'string' || !disruptionId) {
      throw new HttpError(400, 'date (YYYY-MM-DD) and disruptionId are required');
    }
    try {
      const r = await estimateForDisruption(deps, date, disruptionId);
      return json({ estimates: r.estimates.map(toEstimate), cached: r.cached, missing: r.missing });
    } catch (e) {
      if (!(e instanceof GeminiError)) throw e;
      const stale = await deps.repo.latestEstimatesFor(disruptionId);
      return fail(503, 'AI estimates are unavailable right now', { stale: true, estimates: stale.map(toEstimate) });
    }
  });
}
