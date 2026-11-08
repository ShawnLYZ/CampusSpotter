import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The forbidden string is assembled so this file does not match itself.
const FORBIDDEN = [['fixtures', '/'].join('')];

describe('Supabase provider isolation', () => {
  it('never references fixture data', () => {
    const dir = import.meta.dirname;
    const files = readdirSync(dir, { recursive: true, withFileTypes: true }).filter((f) => f.isFile());
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const text = readFileSync(join(f.parentPath, f.name), 'utf8');
      for (const bad of FORBIDDEN) expect(text.includes(bad), `${f.name} contains ${bad}`).toBe(false);
    }
  });
});
