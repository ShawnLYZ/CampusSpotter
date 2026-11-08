import { describe, expect, it } from 'vitest';
import { isSupabaseKey, requireSupabaseKey, supabaseKeyProblem } from './keys.ts';

const PUB = 'sb_publishable_abc123';
const SECRET = 'sb_secret_abc123';
const LEGACY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.sig';

describe('supabaseKeyProblem', () => {
  it('accepts a key of the asked kind', () => {
    expect(supabaseKeyProblem('K', PUB, 'publishable')).toBeNull();
    expect(supabaseKeyProblem('K', SECRET, 'secret')).toBeNull();
  });

  it('reports a missing key', () => {
    expect(supabaseKeyProblem('K', undefined, 'publishable')).toBe('K is not set.');
    expect(supabaseKeyProblem('K', '', 'secret')).toBe('K is not set.');
  });

  it('rejects a legacy JWT key and says so', () => {
    expect(supabaseKeyProblem('K', LEGACY, 'publishable')).toMatch(/^K holds a legacy anon or service_role key.*sb_publishable_\.$/);
    expect(supabaseKeyProblem('K', LEGACY, 'secret')).toMatch(/legacy.*sb_secret_\.$/);
  });

  it('rejects a secret key where a publishable key belongs', () => {
    expect(supabaseKeyProblem('K', SECRET, 'publishable')).toMatch(/^K holds a secret key, which must never be used in the website/);
  });

  it('rejects the wrong kind or a bare prefix', () => {
    expect(supabaseKeyProblem('K', PUB, 'secret')).toMatch(/^K must be the secret key/);
    expect(supabaseKeyProblem('K', 'sb_secret_', 'secret')).toMatch(/^K must be the secret key/);
    expect(supabaseKeyProblem('K', 'nonsense', 'publishable')).toMatch(/^K must be the publishable key/);
  });

  it('never echoes the value', () => {
    for (const v of [PUB, SECRET, LEGACY, 'nonsense']) {
      for (const kind of ['publishable', 'secret'] as const) expect(supabaseKeyProblem('K', v, kind) ?? '').not.toContain(v);
    }
  });
});

describe('requireSupabaseKey / isSupabaseKey', () => {
  it('returns a valid key and throws the problem otherwise', () => {
    expect(requireSupabaseKey('K', PUB, 'publishable')).toBe(PUB);
    expect(() => requireSupabaseKey('K', LEGACY, 'secret')).toThrow(/legacy/);
  });

  it('checks the prefix', () => {
    expect(isSupabaseKey(SECRET, 'secret')).toBe(true);
    expect(isSupabaseKey(SECRET, 'publishable')).toBe(false);
    expect(isSupabaseKey(null, 'secret')).toBe(false);
  });
});
