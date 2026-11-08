import { createMemoryRepo } from './repo.ts';
import { GeminiError } from './gemini.ts';
import type { callGemini } from './gemini.ts';
import { fixtureTables } from '../../../shared/fixtures/rows/index.ts';

export const TOKEN = 'tok-manager';
export const DEMO_TOKEN = 'tok-demo';

export function seededRepo() {
  return createMemoryRepo(
    structuredClone(fixtureTables) as never,
    {
      [TOKEN]: { id: '00000000-0000-0000-0000-000000000001', role: 'manager' },
      [DEMO_TOKEN]: { id: '00000000-0000-0000-0000-000000000002', role: 'demo' },
    },
  );
}

const b64 = (o: unknown) => btoa(JSON.stringify(o)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
/** An unsigned JWT with the given role claim (none when null): a forged legacy key, which every job must refuse. */
export const roleToken = (role: string | null): string => `${b64({ alg: 'none' })}.${b64(role === null ? {} : { role })}.sig`;

/** The project's secret key in the job tests; jobs accept it only on the apikey header, as pg_cron sends it. */
export const SECRET_KEY = 'sb_secret_test-0123456789abcdef';
export const SECRET_KEYS: readonly string[] = [SECRET_KEY];

/** Headers for a caller: a secret key goes on apikey, anything else (a user token) on Authorization as a Bearer token. */
export const callerHeaders = (token: string | null): Record<string, string> =>
  token === null ? {} : token.startsWith('sb_secret_') ? { apikey: token } : { Authorization: `Bearer ${token}` };

export function authedRequest(body: unknown, token: string | null = TOKEN): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://localhost/fn', { method: 'POST', headers, body: JSON.stringify(body) });
}

/** A fake Gemini: returns each queued reply in turn (the last repeats); an Error is thrown instead. */
export function fakeGemini(...replies: (unknown | GeminiError)[]) {
  const state = { calls: 0, prompts: [] as string[], deadlines: [] as (number | undefined)[] };
  const fn = ((opts: { prompt: string; deadlineAt?: number }) => {
    const r = replies[Math.min(state.calls, replies.length - 1)];
    state.calls++;
    state.prompts.push(opts.prompt);
    state.deadlines.push(opts.deadlineAt);
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve({ data: structuredClone(r), attempts: 1, model: 'gemini-3.5-flash-lite' });
  }) as unknown as typeof callGemini;
  return Object.assign(fn, { state });
}
