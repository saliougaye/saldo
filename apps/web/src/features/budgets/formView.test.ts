import {
  type Budget,
  budgetFormFrom,
  budgetSchema,
  categorySchema,
  emptyBudgetForm,
} from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { CATEGORY, CATEGORY_2, CATEGORY_CHILD, dataWith, tx } from '../test/fixtures';
import { budgetFormView } from './formView';

const TODAY = '2026-09-20';
const DEF = { kind: 'month', startDay: 1 } as const;
const PERIOD = {
  range: { start: '2026-09-01', end: '2026-09-30' },
  isCurrent: true,
  elapsed: 20,
  length: 30,
};
const base = { today: TODAY, def: DEF, period: PERIOD, currency: 'EUR' } as const;

const INCOME = categorySchema.parse({
  ...CATEGORY,
  id: 'i1',
  name: 'Stipendio',
  direction: 'income',
});
const ARCHIVED = categorySchema.parse({
  ...CATEGORY_2,
  id: 'c9',
  archivedAt: '2026-05-01T00:00:00.000Z',
});

const BUDGET: Budget = budgetSchema.parse({
  id: 'b1',
  name: 'Spesa',
  categoryIds: ['c1'],
  amount: 10000,
  period: 'period',
  alertThreshold: 80,
  rollover: false,
  icon: 'cart',
  sortOrder: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z-0000-web',
  deletedAt: null,
});

const past = [
  tx({ id: 'h1', amount: 3000, date: '2026-08-10' }),
  tx({ id: 'h2', amount: 500, date: '2026-08-11', categoryId: CATEGORY_CHILD.id }),
  tx({ id: 'h3', amount: 700, date: '2026-07-10', categoryId: CATEGORY_2.id }),
];
const data = dataWith(past, {
  budgets: [BUDGET],
  categories: [CATEGORY, CATEGORY_CHILD, CATEGORY_2, INCOME, ARCHIVED],
});

describe('budgetFormView', () => {
  it('a new form lists top-level live expense categories, the covered one taken', () => {
    const view = budgetFormView({ ...base, data, mode: 'new', id: null });
    expect(view?.initial).toEqual(emptyBudgetForm());
    expect(view?.categories.map((c) => [c.id, c.taken])).toEqual([
      ['c1', true],
      ['c2', false],
    ]);
    expect(view?.categories[0]).toMatchObject({ name: 'Spesa', icon: 'cart', colorIndex: 1 });
  });

  it("an edit does not count the budget's own categories as taken", () => {
    const view = budgetFormView({ ...base, data, mode: 'edit', id: 'b1' });
    expect(view?.categories.map((c) => c.taken)).toEqual([false, false]);
    expect(view?.initial).toEqual(budgetFormFrom(BUDGET, 2));
    expect(view?.id).toBe('b1');
  });

  it("a child of a covered parent makes the parent taken (the parent's budget covers it)", () => {
    const only = { ...data, budgets: [{ ...BUDGET, categoryIds: [CATEGORY_CHILD.id] }] };
    const view = budgetFormView({ ...base, data: only, mode: 'new', id: null });
    expect(view?.categories.find((c) => c.id === 'c1')?.taken).toBe(false);
  });

  it('hands over the past periods as plain records, parent-level, newest first', () => {
    const view = budgetFormView({ ...base, data, mode: 'new', id: null });
    expect(view?.history).toEqual([{ c1: 3500 }, { c2: 700 }]);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it('gives the category refs for the expansion of a parent', () => {
    const view = budgetFormView({ ...base, data, mode: 'new', id: null });
    expect(view?.categoryRefs).toContainEqual({ id: 'c1a', parentId: 'c1' });
    expect(view?.categoryRefs).toContainEqual({ id: 'c1', parentId: null });
  });

  it("an edit keeps the budget's archived category as a selected, archived tile", () => {
    const held = { ...data, budgets: [{ ...BUDGET, categoryIds: ['c1', 'c9'] }] };
    const view = budgetFormView({ ...base, data: held, mode: 'edit', id: 'b1' });
    expect(view?.categories.map((c) => [c.id, c.archived, c.taken])).toEqual([
      ['c1', false, false],
      ['c2', false, false],
      ['c9', true, false],
    ]);
    const fresh = budgetFormView({ ...base, data: held, mode: 'new', id: null });
    expect(fresh?.categories.some((c) => c.id === 'c9')).toBe(false);
  });

  it('is null for an unknown id', () => {
    expect(budgetFormView({ ...base, data, mode: 'edit', id: 'nope' })).toBeNull();
  });
});
