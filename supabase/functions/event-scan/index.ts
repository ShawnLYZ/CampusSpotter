import { createAdminClient } from '../_shared/admin.ts';
import { env, secretKeys as readSecretKeys } from '../_shared/env.ts';
import { callGemini } from '../_shared/gemini.ts';
import { createSupabaseRepo } from '../_shared/repo.ts';
import { handle } from './handler.ts';

const secretKeys = readSecretKeys();
const repo = createSupabaseRepo(createAdminClient(secretKeys));
const apiKey = env('GEMINI_API_KEY');

Deno.serve((req) => handle(req, { repo, fetchFn: fetch, gemini: callGemini, apiKey, now: () => new Date(), secretKeys }));
