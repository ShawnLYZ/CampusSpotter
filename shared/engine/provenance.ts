import type { Label } from './types.ts';

export const LABEL_RANK: Record<Label, number> = { verified: 3, baseline: 2, ai: 1 };

export function weakest(...labels: (Label | null | undefined)[]): Label | null {
  let out: Label | null = null;
  for (const l of labels) {
    if (l == null) continue;
    if (out === null || LABEL_RANK[l] < LABEL_RANK[out]) out = l;
  }
  return out;
}

export function mergeInputs(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) for (const id of list) if (!seen.has(id)) { seen.add(id); out.push(id); }
  return out;
}
