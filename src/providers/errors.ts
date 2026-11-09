export type ProviderErrorCode = 'forbidden' | 'not_found' | 'unavailable' | 'invalid';

export class ProviderError extends Error {
  code: ProviderErrorCode;
  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }
}

interface ErrorLike { code?: unknown; status?: unknown; message?: unknown }

/** Maps a Supabase/PostgREST failure to a ProviderError. `thing` completes "Guest accounts can’t change <thing>." */
export function toProviderError(e: unknown, thing: string): ProviderError {
  if (e instanceof ProviderError) return e;
  const err = (typeof e === 'object' && e !== null ? e : {}) as ErrorLike;
  if (err.code === '42501') return forbiddenWrite(thing);
  if (err.status === 404 || err.code === 'PGRST116') return new ProviderError('not_found', `Couldn’t find ${thing}.`);
  const detail = typeof err.message === 'string' && err.message ? ` (${err.message})` : '';
  return new ProviderError('unavailable', `Couldn’t reach the server for ${thing}${detail}.`);
}

/** A write that touched no rows was blocked by row-level security. */
export function forbiddenWrite(thing: string): ProviderError {
  return new ProviderError('forbidden', `Guest accounts can’t change ${thing}.`);
}
