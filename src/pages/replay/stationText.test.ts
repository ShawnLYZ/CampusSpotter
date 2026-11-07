import { describe, expect, it } from 'vitest';
import { stationText } from './stationText.ts';

describe('stationText', () => {
  it('formats the verified line with the normal figure', () => {
    expect(stationText({ boardings: 12345, alightings: 41000, typicalBoardings: 9000 }))
      .toBe('LRT Bukit Jalil, Wed 4 Nov 2026: 41,000 alightings · 12,345 boardings (normal ≈ 9,000)');
  });
  it('omits the normal figure when unknown', () => {
    expect(stationText({ boardings: 1, alightings: 2, typicalBoardings: null }))
      .toBe('LRT Bukit Jalil, Wed 4 Nov 2026: 2 alightings · 1 boardings');
  });
});
