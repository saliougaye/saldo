import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './__tests__/fixtures';
import { suggestBudgetAmount } from './budgets';

describe('suggestBudgetAmount', () => {
  it('returns the median of past cycle totals', () => {
    const history = [
      new Map([
        ['cat-groceries', 40000],
        ['cat-supermarket', 1000],
      ]),
      new Map([['cat-groceries', 38000]]),
      new Map([['cat-supermarket', 45000]]),
    ];
    expect(suggestBudgetAmount(history, ['cat-groceries'], CATEGORIES)).toBe(41000);
  });

  it('returns null without history or categories', () => {
    expect(suggestBudgetAmount([], ['cat-groceries'], CATEGORIES)).toBeNull();
    expect(suggestBudgetAmount([new Map()], [], CATEGORIES)).toBeNull();
  });
});
