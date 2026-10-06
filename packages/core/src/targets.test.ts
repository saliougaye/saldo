import { describe, expect, it } from 'vitest';
import { featuredTarget, type RankedTarget } from './targets';

const item = (id: string, tier: number, score: number, margin = 0.05): RankedTarget => ({
  id,
  tier,
  score,
  margin,
});

describe('featuredTarget', () => {
  it('lets a higher tier win whatever the scores', () => {
    expect(featuredTarget([item('a', 0, 9), item('b', 1, 0.01)], null)).toBe('b');
  });

  it('ranks inside a tier by score', () => {
    expect(featuredTarget([item('a', 1, 0.1), item('b', 1, 0.3), item('c', 1, 0.2)], null)).toBe(
      'b',
    );
  });

  it('keeps the previous item while a rival in its tier is within the margin', () => {
    expect(featuredTarget([item('a', 1, 0.12), item('b', 1, 0.1)], 'b')).toBe('b');
  });

  it('hands over once a rival in the same tier beats the margin', () => {
    expect(featuredTarget([item('a', 1, 0.2), item('b', 1, 0.1)], 'b')).toBe('a');
  });

  it('hands over at once to a higher tier', () => {
    expect(featuredTarget([item('a', 2, 1), item('b', 1, 0.9)], 'b')).toBe('a');
  });

  it('ignores a previous id that is no longer among the items', () => {
    expect(featuredTarget([item('a', 0, 0.4)], 'gone')).toBe('a');
  });

  it('measures the margin in the previous item’s own units', () => {
    // Money scores: 5% of a 420,00 € limit is 2100 minor units.
    expect(featuredTarget([item('a', 2, 3000, 2000), item('b', 2, 1080, 2100)], 'b')).toBe('b');
    expect(featuredTarget([item('a', 2, 3500, 2000), item('b', 2, 1080, 2100)], 'b')).toBe('a');
  });
});
