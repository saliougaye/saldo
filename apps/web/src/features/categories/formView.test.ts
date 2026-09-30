import { budgetSchema, categorySchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { CATEGORY, CATEGORY_2, CATEGORY_CHILD, dataWith } from '../test/fixtures';
import { categoryFormView } from './formView';

const INCOME = categorySchema.parse({
  ...CATEGORY,
  id: 'i1',
  name: 'Stipendio',
  direction: 'income',
});
const OWN_BUDGET = budgetSchema.parse({
  id: 'b1',
  name: 'Spesa',
  categoryIds: ['c1'],
  amount: 12550,
  period: 'period',
  alertThreshold: 90,
  rollover: false,
  icon: 'cart',
  sortOrder: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z-0000-web',
  deletedAt: null,
});

describe('categoryFormView', () => {
  it('starts a new category empty, with the parents of each direction', () => {
    const view = categoryFormView({
      data: dataWith([], { categories: [CATEGORY, CATEGORY_2, INCOME] }),
      currency: 'EUR',
      mode: 'new',
      id: null,
    });
    expect(view?.initial.name).toBe('');
    expect(view?.parents.expense.map((p) => p.id)).toEqual(['c1', 'c2']);
    expect(view?.parents.income.map((p) => p.id)).toEqual(['i1']);
    expect(view?.minorDigits).toBe(2);
  });

  it('edits with the own budget amount, and never offers itself as a parent', () => {
    const view = categoryFormView({
      data: dataWith([], { categories: [CATEGORY, CATEGORY_2], budgets: [OWN_BUDGET] }),
      currency: 'EUR',
      mode: 'edit',
      id: 'c1',
    });
    expect(view?.initial.budgetEnabled).toBe(true);
    expect(view?.initial.budgetBuffer).toBe('125.5');
    expect(view?.parents.expense.map((p) => p.id)).toEqual(['c2']);
    expect(view?.hasChildren).toBe(false);
  });

  it('a budget over several categories is not the category’s own', () => {
    const shared = budgetSchema.parse({ ...OWN_BUDGET, categoryIds: ['c1', 'c2'] });
    const view = categoryFormView({
      data: dataWith([], { categories: [CATEGORY, CATEGORY_2], budgets: [shared] }),
      currency: 'EUR',
      mode: 'edit',
      id: 'c1',
    });
    expect(view?.initial.budgetEnabled).toBe(false);
  });

  it('a category with children has no parent to pick', () => {
    const view = categoryFormView({
      data: dataWith([], { categories: [CATEGORY, CATEGORY_2, CATEGORY_CHILD] }),
      currency: 'EUR',
      mode: 'edit',
      id: 'c1',
    });
    expect(view?.hasChildren).toBe(true);
    expect(view?.parents.expense).toEqual([]);
  });

  it('returns null for an id that is not a live category', () => {
    const archived = categorySchema.parse({ ...CATEGORY, archivedAt: '2026-05-01T00:00:00.000Z' });
    const data = dataWith([], { categories: [archived] });
    expect(categoryFormView({ data, currency: 'EUR', mode: 'edit', id: 'c1' })).toBeNull();
    expect(categoryFormView({ data, currency: 'EUR', mode: 'edit', id: 'nope' })).toBeNull();
  });
});
