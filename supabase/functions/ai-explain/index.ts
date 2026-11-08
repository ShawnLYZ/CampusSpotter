import { createClient } from 'npm:@supabase/supabase-js@2';
import { env } from '../_shared/env.ts';
import { callGemini } from '../_shared/gemini.ts';
import { createSupabaseRepo } from '../_shared/repo.ts';
import { handle } from './handler.ts';

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
const repo = createSupabaseRepo(admin);

Deno.serve((req) => handle(req, { repo, gemini: callGemini, apiKey: env('GEMINI_API_KEY'), now: () => new Date() }));
