import { createAdminClient } from '../_shared/admin.ts';
import { env } from '../_shared/env.ts';
import { callGemini } from '../_shared/gemini.ts';
import { createSupabaseRepo } from '../_shared/repo.ts';
import { handle } from './handler.ts';

const admin = createAdminClient();
const repo = createSupabaseRepo(admin);

Deno.serve((req) => handle(req, { repo, gemini: callGemini, apiKey: env('GEMINI_API_KEY'), now: () => new Date() }));
