import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './__tests__/fixtures';
import { suggestBudgetAmount, unbudgetedSpend } from './budgets';

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

describe('unbudgetedSpend', () => {
  const spending = new Map([
    ['cat-groceries', 1000],
    // A child of a budgeted parent is budgeted too.
    ['cat-supermarket', 500],
    ['cat-rent', 2000],
    ['cat-transport', 300],
  ]);

  it('adds up the spend in categories that no budget covers', () => {
    const budgets = [{ id: 'b1', categoryIds: ['cat-groceries'] }];
    expect(unbudgetedSpend(budgets, spending, CATEGORIES)).toBe(2300);
  });

  it('is all the spend with no budget', () => {
    expect(unbudgetedSpend([], spending, CATEGORIES)).toBe(3800);
  });

  it('is zero when budgets cover every category spent in', () => {
    const budgets = [
      { id: 'b1', categoryIds: ['cat-groceries', 'cat-home'] },
      { id: 'b2', categoryIds: ['cat-transport'] },
    ];
    expect(unbudgetedSpend(budgets, spending, CATEGORIES)).toBe(0);
  });
});
