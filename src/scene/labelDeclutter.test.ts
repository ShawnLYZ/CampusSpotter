import { describe, expect, it } from 'vitest';
import { labelOrder, labelSeverity, placeLabels } from './labelDeclutter.ts';

describe('labelSeverity', () => {
  it('ranks red > amber > grey > green > none', () => {
    expect(labelSeverity('red', 'ok')).toBeGreaterThan(labelSeverity('amber', 'ok'));
    expect(labelSeverity('amber', 'ok')).toBeGreaterThan(labelSeverity(null, 'no_service'));
    expect(labelSeverity(null, 'not_enough_data')).toBeGreaterThan(labelSeverity('green', 'ok'));
    expect(labelSeverity('green', 'ok')).toBeGreaterThan(labelSeverity(null, 'ok'));
  });
});

describe('labelOrder', () => {
  it('orders by severity, ties by index, drops no-label zones', () => {
    expect(labelOrder([0, 3, -1, 2, 3, 1], -1)).toEqual([1, 4, 3, 5, 0]);
  });
  it('puts the selected zone first', () => {
    expect(labelOrder([0, 3, 2], 0)).toEqual([0, 1, 2]);
  });
});

describe('placeLabels', () => {
  const f = (a: number[]) => Float32Array.from(a);
  it('keeps the more severe of two overlapping chips and drops non-candidates', () => {
    const visible = new Uint8Array(4);
    placeLabels([1, 0, 2, 3], Uint8Array.from([1, 1, 1, 0]), f([100, 110, 400, 100]), f([50, 50, 50, 50]),
      f([30, 30, 30, 30]), f([10, 10, 10, 10]), visible);
    expect([...visible]).toEqual([0, 1, 1, 0]);
  });
  it('shows chips that only touch within the gap-free distance', () => {
    const visible = new Uint8Array(2);
    placeLabels([0, 1], Uint8Array.from([1, 1]), f([0, 100]), f([0, 0]), f([40, 40]), f([10, 10]), visible);
    expect([...visible]).toEqual([1, 1]);
  });
});
