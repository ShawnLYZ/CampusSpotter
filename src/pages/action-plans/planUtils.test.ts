import { describe, expect, it } from 'vitest';
import { groupByTeam } from './planUtils.ts';

describe('groupByTeam', () => {
  it('orders teams and drops empty ones', () => {
    const g = groupByTeam([{ team: 'academic', n: 1 }, { team: 'transport', n: 2 }, { team: 'academic', n: 3 }] as const);
    expect(g.map((x) => x.team)).toEqual(['transport', 'academic']);
    expect(g[1].items.map((i) => i.n)).toEqual([1, 3]);
  });
});
