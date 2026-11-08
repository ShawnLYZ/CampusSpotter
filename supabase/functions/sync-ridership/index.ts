import { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from 'npm:hyparquet@1';
import { compressors } from 'npm:hyparquet-compressors@1';
import { createAdminClient } from '../_shared/admin.ts';
import { secretKeys as readSecretKeys } from '../_shared/env.ts';
import { createSupabaseRepo } from '../_shared/repo.ts';
import { handle } from './handler.ts';
import type { ParquetLib } from './parquet.ts';

const secretKeys = readSecretKeys();
const repo = createSupabaseRepo(createAdminClient(secretKeys));
const lib = { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects, compressors } as unknown as ParquetLib;

Deno.serve((req) => handle(req, { repo, now: () => new Date(), lib, secretKeys }));
