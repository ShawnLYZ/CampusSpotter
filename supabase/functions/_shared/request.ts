import { preflight } from './cors.ts';
import { fail, HttpError } from './http.ts';
import { getCaller } from './auth.ts';
import type { Caller } from './auth.ts';
import { RepoError } from './repo.ts';
import type { Repo } from './repo.ts';

/** A fixed, user-text-free description of an error for logs: its name plus a status or repo label. Never the message. */
export function errorCategory(e: unknown): string {
  if (e instanceof HttpError) return `HttpError ${e.status}`;
  if (e instanceof RepoError) return `RepoError ${e.what}`;
  return e instanceof Error ? e.name : 'unknown';
}

/**
 * Common request boilerplate: CORS preflight, caller auth (401), and error mapping
 * (HttpError keeps its status; anything else becomes a generic 500 that never echoes user text).
 * Handlers may return their own Response for expected failures (e.g. 503 stale).
 */
export async function serveRequest(
  req: Request,
  repo: Repo,
  run: (caller: Caller) => Promise<Response>,
): Promise<Response> {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const caller = await getCaller(req, repo);
    if (!caller) return fail(401, 'unauthorized');
    return await run(caller);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error('unhandled error', errorCategory(e));
    return fail(500, 'internal error');
  }
}
