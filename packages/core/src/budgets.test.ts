import { describe, expect, it } from 'vitest';
import { APRIL_CYCLE, aprilTransactions, CATEGORIES, TODAY } from './__tests__/fixtures';
import {
  autoBudgetName,
  budgetProgress,
  expandCategoryIds,
  suggestBudgetAmount,
  takenCategoryIds,
} from './budgets';
import { spendingByCategory } from './ledger';

const PACE = 23 / 31;

describe('expandCategoryIds', () => {
  it('adds children of selected parents', () => {
    expect([...expandCategoryIds(['cat-groceries'], CATEGORIES)].sort()).toEqual([
      'cat-groceries',
      'cat-supermarket',
    ]);
    expect([...expandCategoryIds(['cat-rent'], CATEGORIES)]).toEqual(['cat-rent']);
  });
});

describe('budgetProgress', () => {
  const spending = spendingByCategory(aprilTransactions(), APRIL_CYCLE, TODAY);

  it('sums parent and child spending under the pace', () => {
    const progress = budgetProgress(
      { categoryIds: ['cat-groceries'], amount: 42000, alertThreshold: 90 },
      spending,
      CATEGORIES,
      PACE,
    );
    expect(progress).toMatchObject({
      spent: 8240,
      limit: 42000,
      overPace: false,
      overLimit: false,
      alertReached: false,
    });
    expect(progress.ratio).toBeCloseTo(8240 / 42000, 10);
  });

  it('flags over pace, over limit and alert', () => {
    const progress = budgetProgress(
      { categoryIds: ['cat-home'], amount: 70000, alertThreshold: 100 },
      spending,
      CATEGORIES,
      PACE,
    );
    expect(progress).toMatchObject({
      spent: 78000,
      overPace: true,
      overLimit: true,
      alertReached: true,
    });
  });

  it('never alerts when the threshold is null', () => {
    const progress = budgetProgress(
      { categoryIds: ['cat-home'], amount: 70000, alertThreshold: null },
      spending,
      CATEGORIES,
      PACE,
    );
    expect(progress.alertReached).toBe(false);
  });
});

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

describe('takenCategoryIds', () => {
  it('collects categories of other budgets including children', () => {
    const budgets = [
      { id: 'b1', categoryIds: ['cat-home'] },
      { id: 'b2', categoryIds: ['cat-groceries'] },
    ];
    expect([...takenCategoryIds(budgets, CATEGORIES, 'b2')].sort()).toEqual([
      'cat-home',
      'cat-rent',
    ]);
  });
});

describe('autoBudgetName', () => {
  it('names budgets from their categories', () => {
    expect(autoBudgetName([], 'e')).toBe('');
    expect(autoBudgetName(['Spesa'], 'e')).toBe('Spesa');
    expect(autoBudgetName(['Spesa', 'Casa'], 'e')).toBe('Spesa e Casa');
    expect(autoBudgetName(['Spesa', 'Casa', 'Sport'], 'e')).toBe('Spesa +2');
  });
});
