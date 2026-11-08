import { createClient } from 'npm:@supabase/supabase-js@2';
import { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from 'npm:hyparquet@1';
import { compressors } from 'npm:hyparquet-compressors@1';
import { env } from '../_shared/env.ts';
import { createSupabaseRepo } from '../_shared/repo.ts';
import { handle } from './handler.ts';
import type { ParquetLib } from './parquet.ts';

const repo = createSupabaseRepo(createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY')));
const lib = { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects, compressors } as unknown as ParquetLib;

Deno.serve((req) => handle(req, { repo, now: () => new Date(), lib }));
