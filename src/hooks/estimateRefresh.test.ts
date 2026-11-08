import { describe, expect, it } from 'vitest';
import type { Estimate, InputBundle } from '@engine/index.ts';
import { markStale } from '../providers/staleEstimates.ts';
import { applyRefresh } from './estimateRefresh.ts';

const est = (key: string) => ({ key }) as unknown as Estimate;
const bundle = { estimates: [est('saved')] } as unknown as InputBundle;

describe('applyRefresh', () => {
  it('uses fresh estimates', () => {
    const r = applyRefresh(bundle, [est('new')]);
    expect(r.bundle.estimates.map((e) => e.key)).toEqual(['new']);
    expect(r.estimatesStale).toBe(false);
  });
  it('keeps the bundle when the result is empty', () => {
    expect(applyRefresh(bundle, [])).toEqual({ bundle, estimatesStale: false });
  });
  it('keeps saved estimates and flags a stale result', () => {
    expect(applyRefresh(bundle, markStale([est('old')]))).toEqual({ bundle, estimatesStale: true });
  });
  it('keeps saved estimates when the refresh failed', () => {
    expect(applyRefresh(bundle, null)).toEqual({ bundle, estimatesStale: false });
  });
});
