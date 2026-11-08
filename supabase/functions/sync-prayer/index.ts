import { createClient } from 'npm:@supabase/supabase-js@2';
import { env } from '../_shared/env.ts';
import { createSupabaseRepo } from '../_shared/repo.ts';
import { handle } from './handler.ts';

const repo = createSupabaseRepo(createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY')));

Deno.serve((req) => handle(req, { repo, fetchFn: fetch, now: () => new Date() }));
