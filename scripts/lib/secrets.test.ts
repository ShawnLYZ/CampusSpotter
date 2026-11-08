import { describe, it, expect } from 'vitest';
import { scanForSecrets } from './secrets.ts';

const b64url = (s: string) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwtFor = (claims: object) => `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${b64url(JSON.stringify(claims))}.c2ln`;

describe('scanForSecrets', () => {
  it('flags a Gemini key', () => {
    const findings = scanForSecrets([{ path: 'assets/app.js', content: 'const k="AQ.FAKEtestKEY0000000000000000000"' }], {});
    expect(findings.map((f) => f.kind)).toEqual(['gemini_key']);
  });

  it('flags a Supabase secret key', () => {
    const findings = scanForSecrets([{ path: 'assets/app.js', content: 'const k="sb_secret_FAKEtest0000-_0000"' }], {});
    expect(findings.map((f) => f.kind)).toEqual(['supabase_secret_key']);
  });

  it('ignores a Supabase publishable key', () => {
    expect(scanForSecrets([{ path: 'assets/app.js', content: 'const k="sb_publishable_FAKEtest0000_0000"' }], {})).toEqual([]);
  });

  it('flags the exact Gemini key when it has no AQ. prefix, once', () => {
    const geminiKey = 'AIzaSyGEMINI000000000000000000000000000';
    const findings = scanForSecrets([{ path: 'assets/app.js', content: `const k="${geminiKey}"` }], { geminiKey });
    expect(findings.map((f) => f.kind)).toEqual(['gemini_key']);
    expect(findings[0].excerpt).not.toContain(geminiKey);
    const aq = 'AQ.FAKEtestKEY0000000000000000000';
    expect(scanForSecrets([{ path: 'assets/app.js', content: `const k="${aq}"` }], { geminiKey: aq })).toHaveLength(1);
  });

  it('flags a Supabase PAT', () => {
    const findings = scanForSecrets([{ path: 'assets/app.js', content: 'const t="sbp_0123456789abcdefghij0123"' }], {});
    expect(findings.map((f) => f.kind)).toEqual(['supabase_pat']);
  });

  it('flags a JWT whose payload role is service_role', () => {
    const findings = scanForSecrets([{ path: 'assets/app.js', content: `const j="${jwtFor({ role: 'service_role' })}"` }], {});
    expect(findings.map((f) => f.kind)).toEqual(['service_role_jwt']);
  });

  it('flags a service_role JWT embedded in a longer string', () => {
    const findings = scanForSecrets([{ path: 'assets/app.js', content: `x=Bearer ${jwtFor({ role: 'service_role' })};` }], {});
    expect(findings.map((f) => f.kind)).toEqual(['service_role_jwt']);
  });

  it('ignores an anon JWT', () => {
    expect(scanForSecrets([{ path: 'assets/app.js', content: `const j="${jwtFor({ role: 'anon' })}"` }], {})).toEqual([]);
  });

  it('ignores a JWT whose payload does not decode', () => {
    expect(scanForSecrets([{ path: 'assets/app.js', content: `const j="eyJhbGciOiJIUzI1NiJ9.${b64url('{"role":')}.c2ln"` }], {})).toEqual([]);
  });

  it('ignores a Maps key', () => {
    expect(scanForSecrets([{ path: 'assets/app.js', content: 'const k="AIzaSyTEST00000000000000000000000000"' }], {})).toEqual([]);
  });

  it('flags the DB password embedded in a longer string', () => {
    const findings = scanForSecrets([{ path: 'assets/app.js', content: 'x=Secret@123;' }], { dbPassword: 'Secret@123' });
    expect(findings.map((f) => f.kind)).toEqual(['db_password']);
  });

  it('ignores the DB password rule when no password is given', () => {
    expect(scanForSecrets([{ path: 'assets/app.js', content: 'x=Secret@123;' }], {})).toEqual([]);
    expect(scanForSecrets([{ path: 'assets/app.js', content: 'x=Secret@123;' }], { dbPassword: '' })).toEqual([]);
  });

  it('never returns the full secret in an excerpt', () => {
    const jwt = jwtFor({ role: 'service_role' });
    const findings = scanForSecrets(
      [
        { path: 'assets/a.js', content: `const k="AQ.FAKEtestKEY0000000000000000000"` },
        { path: 'assets/b.js', content: `const j="${jwt}"` },
        { path: 'assets/c.js', content: 'x=Secret@123;' },
      ],
      { dbPassword: 'Secret@123' },
    );
    expect(findings).toHaveLength(3);
    for (const f of findings) {
      expect(f.excerpt).toContain('***');
      expect(f.excerpt).not.toContain('AQ.FAKEtestKEY0000000000000000000');
      expect(f.excerpt).not.toContain(jwt);
      expect(f.excerpt).not.toContain('Secret@123');
    }
    expect(findings.every((f) => f.file.startsWith('assets/'))).toBe(true);
  });
});
