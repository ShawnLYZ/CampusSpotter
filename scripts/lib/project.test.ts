import { describe, expect, it } from 'vitest';
import { pickSecretKey, project } from './project.ts';

describe('project', () => {
  it('reads the origin and project ID, with or without a path', () => {
    expect(project('https://abcdefghijklmnopqrst.supabase.co')).toEqual({ url: 'https://abcdefghijklmnopqrst.supabase.co', ref: 'abcdefghijklmnopqrst' });
    expect(project('https://abcdefghijklmnopqrst.supabase.co/rest/v1/')).toEqual({ url: 'https://abcdefghijklmnopqrst.supabase.co', ref: 'abcdefghijklmnopqrst' });
  });

  it('rejects anything else with the same message', () => {
    for (const raw of ['', 'abcdefghijklmnopqrst', 'http://abc.supabase.co', 'https://example.com', 'https://a.b.supabase.co']) {
      expect(() => project(raw)).toThrow('VITE_SUPABASE_URL must look like https://<project-id>.supabase.co');
    }
  });
});

describe('pickSecretKey', () => {
  const legacy = { name: 'service_role', type: 'legacy', api_key: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig' };
  const pub = { name: 'default', type: 'publishable', api_key: 'sb_publishable_abc' };

  it('prefers the secret key named default', () => {
    const rows = [legacy, pub, { name: 'cron', type: 'secret', api_key: 'sb_secret_cron' }, { name: 'default', type: 'secret', api_key: 'sb_secret_dflt' }];
    expect(pickSecretKey(rows)).toBe('sb_secret_dflt');
  });

  it('falls back to the first secret key', () => {
    expect(pickSecretKey([pub, { name: 'cron', type: 'secret', api_key: 'sb_secret_cron' }])).toBe('sb_secret_cron');
  });

  it('never returns a legacy key, and says how to create a secret key when there is none', () => {
    expect(() => pickSecretKey([legacy, pub])).toThrow(/no secret API key; create one/);
    expect(() => pickSecretKey([{ name: 'default', type: 'secret', api_key: null }])).toThrow(/no secret API key/);
    expect(() => pickSecretKey({ error: 'nope' })).toThrow(/no secret API key/);
  });
});
