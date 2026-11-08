import { describe, expect, it, vi } from 'vitest';
import { checkAuth, nextGuardState } from './checkAuth.ts';
import { ProviderError } from '../providers/errors.ts';

const user = { id: 'u', displayName: 'U', role: 'demo' as const };

describe('checkAuth', () => {
  it('is in for a signed-in user', async () => {
    expect(await checkAuth({ currentUser: async () => user })).toBe('in');
  });
  it('is out when there is no user (expired or ended session)', async () => {
    expect(await checkAuth({ currentUser: async () => null })).toBe('out');
  });
  it('is out when the account has no profile', async () => {
    expect(await checkAuth({ currentUser: async () => { throw new ProviderError('forbidden', 'x'); } })).toBe('out');
  });
  it('is error, not a hang, on a transient failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await checkAuth({ currentUser: async () => { throw new ProviderError('unavailable', 'x'); } })).toBe('error');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('nextGuardState', () => {
  it('keeps the page on a transient error once in', () => {
    expect(nextGuardState('in', 'error')).toBe('in');
  });
  it('shows the error on the first check or a retry', () => {
    expect(nextGuardState('pending', 'error')).toBe('error');
  });
  it('still signs out and signs in', () => {
    expect(nextGuardState('in', 'out')).toBe('out');
    expect(nextGuardState('error', 'in')).toBe('in');
  });
});
