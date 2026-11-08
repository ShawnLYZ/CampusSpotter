import { createAdminClient } from '../_shared/admin.ts';
import { secretKeys as readSecretKeys } from '../_shared/env.ts';
import { createSupabaseRepo } from '../_shared/repo.ts';
import { handle } from './handler.ts';

const secretKeys = readSecretKeys();
const repo = createSupabaseRepo(createAdminClient(secretKeys));

Deno.serve((req) => handle(req, { repo, fetchFn: fetch, now: () => new Date(), secretKeys }));
