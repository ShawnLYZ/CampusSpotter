import { ENGINE_VERSION } from '../_shared/engine.ts';

export function handle(_req: Request): Response {
  return new Response(JSON.stringify({ engineVersion: ENGINE_VERSION }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
