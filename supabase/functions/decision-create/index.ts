import { createAdminClient } from '../_shared/admin.ts';
import { createSupabaseRepo } from '../_shared/repo.ts';
import { handle } from './handler.ts';

const admin = createAdminClient();
const repo = createSupabaseRepo(admin);

Deno.serve((req) => handle(req, { repo, now: () => new Date() }));
