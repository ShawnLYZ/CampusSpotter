import type { Repo } from './repo.ts';

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A 'running' row older than this was killed by the runtime (the Edge wall limit is 150 s) and is closed as 'interrupted'. */
export const STALE_RUN_MS = 10 * 60 * 1000;
/** The 500 message when a run succeeded but its job_runs row could not be finished. */
export const FINISH_FAILED_MESSAGE = 'job finished but its run record could not be saved';

/**
 * Runs a sync job, recording its start, finish, counts and any error in job_runs. Runs of the same job still
 * 'running' after 10 minutes are closed first. A successful result's `note` (its partial failures) becomes the
 * run's error_summary.
 */
export async function runJob<T extends { itemsFound: number; itemsChanged: number; method?: string; note?: string }>(
  repo: Repo,
  name: string,
  fn: () => Promise<T>,
): Promise<Response> {
  await repo.failStaleJobs(name, new Date(Date.now() - STALE_RUN_MS).toISOString());
  const jobRunId = await repo.startJob(name);
  let result: T;
  try {
    result = await fn();
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    try {
      await repo.finishJob(jobRunId, { status: 'failed', errorSummary: error.slice(0, 300) });
    } catch {
      // Keep the original error in the response; a later run closes this row as interrupted.
    }
    return json(500, { jobRunId, error });
  }
  try {
    await repo.finishJob(jobRunId, {
      status: 'success', itemsFound: result.itemsFound, itemsChanged: result.itemsChanged, method: result.method,
      errorSummary: result.note ? result.note.slice(0, 300) : null,
    });
  } catch {
    return json(500, { jobRunId, error: FINISH_FAILED_MESSAGE });
  }
  return json(200, { jobRunId, ...result });
}

/** True when the bearer JWT carries role 'service_role'. The payload is decoded, not verified: the runtime has already verified the token. */
export function requireServiceRole(req: Request): boolean {
  try {
    const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
    const payload = token?.split('.')[1];
    if (!payload) return false;
    const b64 = payload.replaceAll('-', '+').replaceAll('_', '/');
    const bytes = Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    return claims?.role === 'service_role';
  } catch {
    return false;
  }
}
