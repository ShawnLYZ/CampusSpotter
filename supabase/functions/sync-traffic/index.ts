import { createAdminClient } from '../_shared/admin.ts';
import { env, secretKeys as readSecretKeys } from '../_shared/env.ts';
import { createSupabaseRepo } from '../_shared/repo.ts';
import { handle } from './handler.ts';

const secretKeys = readSecretKeys();
const repo = createSupabaseRepo(createAdminClient(secretKeys));
const routesKey = env('GOOGLE_ROUTES_KEY');

Deno.serve((req) => handle(req, { repo, fetchFn: fetch, now: () => new Date(), routesKey, secretKeys }));
