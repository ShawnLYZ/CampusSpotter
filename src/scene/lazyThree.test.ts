import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Three.js must load only with the 3D canvas (the `lazy(() => import(...))` in SceneSlot.tsx), so the
 * login page and the no-WebGL fallback never download it. This walks the static imports reachable
 * from the app entry and fails if any of them reaches Three.js. Dynamic `import()` is not followed.
 */

const SRC = resolve(import.meta.dirname, '..');
const HEAVY = /^(three|@react-three\/.+)(\/|$)/;
/** `import … from 'x'`, `export … from 'x'` and bare `import 'x'`, across lines. */
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/gm;

function resolveFile(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (/\.tsx?$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Every chain is reported as the files leading from the entry to the heavy import. */
function heavyChains(entry: string): string[] {
  const chains: string[] = [];
  const seen = new Set<string>();
  const walk = (file: string, trail: string[]) => {
    if (seen.has(file)) return;
    seen.add(file);
    const here = [...trail, relative(SRC, file).replaceAll('\\', '/')];
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      if (HEAVY.test(spec)) chains.push(`${here.join(' → ')} → ${spec}`);
      else if (spec.startsWith('.')) {
        const next = resolveFile(file, spec);
        if (next) walk(next, here);
      }
    }
  };
  walk(entry, []);
  return chains;
}

describe('Three.js lazy loading', () => {
  it('keeps Three.js out of everything the app entry imports statically', () => {
    expect(heavyChains(join(SRC, 'main.tsx'))).toEqual([]);
  });

  it('does reach Three.js from the lazily loaded canvas, so the walk is not vacuous', () => {
    expect(heavyChains(join(SRC, 'scene', 'CampusCanvas.tsx')).length).toBeGreaterThan(0);
  });
});
