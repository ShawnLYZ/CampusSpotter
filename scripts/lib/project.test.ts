import { describe, expect, it } from 'vitest';
import { projectRef, projectUrl } from './project.ts';

describe('project address', () => {
  it('reads the project ID and base address from VITE_SUPABASE_URL', () => {
    const env = { VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' };
    expect(projectRef(env)).toBe('abcdefghijklmnopqrst');
    expect(projectUrl(env)).toBe('https://abcdefghijklmnopqrst.supabase.co');
  });

  it('drops a /rest/v1/ path', () => {
    const env = { VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co/rest/v1/' };
    expect(projectUrl(env)).toBe('https://abcdefghijklmnopqrst.supabase.co');
    expect(projectRef(env)).toBe('abcdefghijklmnopqrst');
  });

  it('explains a missing or malformed setting', () => {
    expect(() => projectRef({})).toThrow('VITE_SUPABASE_URL is not set');
    expect(() => projectRef({ VITE_SUPABASE_URL: 'not a url' })).toThrow('not a web address');
    expect(() => projectRef({ VITE_SUPABASE_URL: 'https://example.com' })).toThrow('<project-id>.supabase.co');
  });
});
