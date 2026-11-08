import type { DataProvider } from '../providers/DataProvider.ts';
import { ProviderError } from '../providers/errors.ts';

export type AuthCheck = 'in' | 'out' | 'error';

/** Decides what the route guard does: a user is in, no user (or an account with no profile) is out, a transient failure is an error to retry. */
export async function checkAuth(provider: Pick<DataProvider, 'currentUser'>): Promise<AuthCheck> {
  try {
    return (await provider.currentUser()) ? 'in' : 'out';
  } catch (e) {
    if (e instanceof ProviderError && e.code === 'forbidden') return 'out';
    console.warn('Sign-in check failed', e);
    return 'error';
  }
}

/** A transient failure on a re-check must not unmount a page the user is already on; the first check and an explicit retry still show it. */
export function nextGuardState(prev: AuthCheck | 'pending', result: AuthCheck): AuthCheck | 'pending' {
  return result === 'error' && prev === 'in' ? prev : result;
}
