import { describe, it, expect } from 'vitest';
import { weakest, mergeInputs, LABEL_RANK } from './provenance.ts';
import { makeSeries } from './series.ts';
import { pressureOf } from './pressure.ts';

describe('provenance', () => {
  it('ranks labels', () => { expect(LABEL_RANK).toEqual({ verified: 3, baseline: 2, ai: 1 }); });
  it('picks the weakest label, ignoring nulls', () => {
    expect(weakest('verified', 'ai', 'baseline')).toBe('ai');
    expect(weakest('verified', null)).toBe('verified');
    expect(weakest('verified', undefined, 'baseline')).toBe('baseline');
    expect(weakest()).toBeNull();
  });
  it('merges inputs unique in first-seen order', () => {
    expect(mergeInputs(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('makeSeries', () => {
  it('derives status and labels', () => {
    const s = makeSeries([1, null], 'baseline', ['x']);
    expect(s.status).toEqual(['ok', 'not_enough_data']);
    expect(s.labels).toEqual(['baseline', null]);
    expect(s.inputs).toEqual(['x']);
  });
  it('accepts per-step labels and explicit status', () => {
    const s = makeSeries([1, 2, null], ['verified', 'ai', 'ai'], [], ['ok', 'no_service', 'not_enough_data']);
    expect(s.labels).toEqual(['verified', 'ai', null]);
    expect(s.status).toEqual(['ok', 'no_service', 'not_enough_data']);
  });
});

describe('pressureOf', () => {
  const occ = { amberFrom: 85, redAbove: 100, greenInclusive: false };
  const en = { amberFrom: 10, redAbove: 25, greenInclusive: true };
  it('occupancy thresholds', () => {
    expect(pressureOf(84.9, occ)).toBe('green'); expect(pressureOf(85, occ)).toBe('amber');
    expect(pressureOf(100, occ)).toBe('amber'); expect(pressureOf(100.1, occ)).toBe('red');
  });
  it('energy thresholds (green inclusive)', () => {
    expect(pressureOf(10, en)).toBe('green'); expect(pressureOf(10.1, en)).toBe('amber');
    expect(pressureOf(25, en)).toBe('amber'); expect(pressureOf(25.1, en)).toBe('red');
  });
});
