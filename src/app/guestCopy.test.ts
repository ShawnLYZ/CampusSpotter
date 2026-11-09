import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The guest button signs into the `demo` role, and RLS decides what that role can write.
// The copy must not promise less access than the policies grant.
const root = join(import.meta.dirname, '..', '..');

function filesUnder(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((f) => f.isFile() && keep(f.name))
    .map((f) => join(f.parentPath, f.name));
}

describe('guest access copy', () => {
  it('does not call the guest view-only while RLS lets the guest write', () => {
    const migrations = filesUnder(join(root, 'supabase', 'migrations'), (n) => n.endsWith('.sql'))
      .map((p) => readFileSync(p, 'utf8')).join('\n');
    expect(migrations, 'no RLS policies found').toContain('create policy');
    if (!/create policy "\w+_write"[^;]*is_demo\(\)/.test(migrations)) return; // the guest really is read-only

    const shipped = [
      ...filesUnder(join(root, 'src'), (n) => /\.tsx?$/.test(n) && !n.includes('.test.')),
      join(root, 'README.md'),
    ];
    for (const p of shipped) {
      expect(/view[- ]only/i.test(readFileSync(p, 'utf8')), `${p} calls the guest view-only`).toBe(false);
    }
  });
});
