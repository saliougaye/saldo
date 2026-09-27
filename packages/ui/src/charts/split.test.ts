import { describe, expect, it } from 'vitest';
import { splitShares } from './split';

describe('splitShares', () => {
  it('gives each segment its share of the total, in the order given', () => {
    const shares = splitShares([{ amount: 30 }, { amount: 10 }]);
    expect(shares?.map((entry) => entry.share)).toEqual([0.75, 0.25]);
  });

  it('has nothing to split when the total is not positive', () => {
    expect(splitShares([])).toBeNull();
    expect(splitShares([{ amount: 0 }])).toBeNull();
  });

  it('hands each input back with its share', () => {
    const input = { amount: 1 };
    expect(splitShares([input])?.[0]?.segment).toBe(input);
  });
});
