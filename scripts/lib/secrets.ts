export interface Finding {
  file: string;
  kind: 'gemini_key' | 'supabase_pat' | 'service_role_jwt' | 'db_password';
  excerpt: string;
}

export interface ScanOptions {
  dbPassword?: string;
}

const GEMINI_KEY = /AQ\.[A-Za-z0-9_-]{20,}/g;
const SUPABASE_PAT = /sbp_[A-Za-z0-9]{20,}/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const CONTEXT_CHARS = 6;
const MASK = '***';

function decodePayload(token: string): unknown {
  const segment = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = segment.padEnd(Math.ceil(segment.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

function isServiceRoleJwt(token: string): boolean {
  try {
    return (decodePayload(token) as { role?: unknown } | null)?.role === 'service_role';
  } catch {
    return false;
  }
}

// Up to CONTEXT_CHARS on each side of the match; every secret is replaced by MASK, so no full secret is ever returned.
function excerptAround(content: string, start: number, end: number, secrets: string[]): string {
  const mask = (text: string) => secrets.reduce((acc, secret) => acc.split(secret).join(MASK), text);
  const before = mask(content.slice(Math.max(0, start - CONTEXT_CHARS), start));
  const after = mask(content.slice(end, end + CONTEXT_CHARS));
  return `${before}${MASK}${after}`;
}

export function scanForSecrets(files: { path: string; content: string }[], opts: ScanOptions): Finding[] {
  const findings: Finding[] = [];
  const dbPassword = opts.dbPassword ? opts.dbPassword : undefined;
  const secretsFor = (matched: string) => (dbPassword ? [matched, dbPassword] : [matched]);

  for (const { path, content } of files) {
    const addMatches = (pattern: RegExp, kind: Finding['kind'], keep: (token: string) => boolean = () => true) => {
      for (const m of content.matchAll(pattern)) {
        if (!keep(m[0])) continue;
        const start = m.index ?? 0;
        findings.push({ file: path, kind, excerpt: excerptAround(content, start, start + m[0].length, secretsFor(m[0])) });
      }
    };

    addMatches(GEMINI_KEY, 'gemini_key');
    addMatches(SUPABASE_PAT, 'supabase_pat');
    addMatches(JWT, 'service_role_jwt', isServiceRoleJwt);

    if (dbPassword) {
      for (let at = content.indexOf(dbPassword); at !== -1; at = content.indexOf(dbPassword, at + dbPassword.length)) {
        findings.push({ file: path, kind: 'db_password', excerpt: excerptAround(content, at, at + dbPassword.length, [dbPassword]) });
      }
    }
  }
  return findings;
}
