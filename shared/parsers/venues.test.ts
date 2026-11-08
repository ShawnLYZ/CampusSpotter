import { describe, it, expect } from 'vitest';
import { canonicalVenue, titleSimilarity, VENUES, withinKm } from './venues.ts';

describe('canonicalVenue', () => {
  it('maps aliases case-insensitively by substring', () => {
    expect(canonicalVenue('Axiata Arena, Bukit Jalil')).toBe('Unifi Arena');
    expect(canonicalVenue('stadium nasional bukit jalil')).toBe('TM Stadium Nasional');
    expect(canonicalVenue('TM Stadium Nasional')).toBe('TM Stadium Nasional');
    expect(canonicalVenue('Kompleks Sukan Negara Bukit Jalil')).toBe('Bukit Jalil National Sports Complex');
  });
  it('gives null for venues outside the list', () => {
    expect(canonicalVenue('Stadium Merdeka')).toBeNull();
    expect(canonicalVenue('')).toBeNull();
  });
  it('lists the three venues', () => {
    expect(VENUES.map((v) => v.canonical)).toEqual(['TM Stadium Nasional', 'Unifi Arena', 'Bukit Jalil National Sports Complex']);
  });
});

describe('withinKm', () => {
  it('is true near LRT Bukit Jalil and false at KLCC', () => {
    expect(withinKm(3.0547, 101.6914, 3)).toBe(true);
    expect(withinKm(3.139, 101.6869, 3)).toBe(false);
  });
  it('accepts another centre', () => {
    expect(withinKm(3.139, 101.6869, 1, [3.14, 101.687])).toBe(true);
  });
});

describe('titleSimilarity', () => {
  it('matches the RSS and Live Nation BTS titles', () => {
    expect(titleSimilarity('BTS World Tour KL', 'BTS Kuala Lumpur 2026')).toBeGreaterThanOrEqual(0.5);
  });
  it('separates different events', () => {
    expect(titleSimilarity('BTS World Tour KL', 'Coldplay Music of the Spheres')).toBeLessThan(0.5);
  });
  it('is 0 for unrelated stop-word-only titles and 1 for identical ones', () => {
    expect(titleSimilarity('Live Concert', 'World Tour')).toBe(0);
    expect(titleSimilarity('Concert', 'concert')).toBe(1);
  });
});
