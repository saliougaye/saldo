import { type Budget, budgetSchema, categorySchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { CATEGORY, CATEGORY_2, CATEGORY_CHILD, dataWith, tx } from '../test/fixtures';
import { budgetCategoryTiles, budgetFormShared, budgetPrefillFrom } from './formView';

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

const PERIOD = {
  today: '2026-09-20',
  def: { kind: 'month', startDay: 1 },
  period: {
    range: { start: '2026-09-01', end: '2026-09-30' },
    isCurrent: true,
    elapsed: 20,
    length: 30,
  },
} as const;

describe('budgetFormShared', () => {
  it('hands over the past periods as plain records, parent-level, newest first', () => {
    const data = dataWith(
      [
        tx({ id: 'h1', amount: 3000, date: '2026-08-10' }),
        tx({ id: 'h2', amount: 500, date: '2026-08-11', categoryId: CATEGORY_CHILD.id }),
        tx({ id: 'h3', amount: 700, date: '2026-07-10', categoryId: CATEGORY_2.id }),
      ],
      { budgets: [BUDGET], categories: [CATEGORY, CATEGORY_CHILD, CATEGORY_2] },
    );
    const shared = budgetFormShared({
      data,
      today: '2026-09-20',
      def: { kind: 'month', startDay: 1 },
      period: {
        range: { start: '2026-09-01', end: '2026-09-30' },
        isCurrent: true,
        elapsed: 20,
        length: 30,
      },
    });
    expect(shared.history).toEqual([{ c1: 3500 }, { c2: 700 }]);
    expect(JSON.parse(JSON.stringify(shared))).toEqual(shared);
  });
});

describe('budgetCategoryTiles', () => {
  const archived = (id: string) =>
    categorySchema.parse({ ...CATEGORY_2, id, archivedAt: '2026-09-01T00:00:00.000Z' });

  it('keeps an archived category the budget holds, and does not mark its own as taken', () => {
    const held = budgetSchema.parse({ ...BUDGET, categoryIds: [CATEGORY.id, 'x1'] });
    const other = budgetSchema.parse({ ...BUDGET, id: 'b2', categoryIds: [CATEGORY_2.id] });
    const shared = budgetFormShared({
      ...PERIOD,
      data: dataWith([], {
        budgets: [held, other],
        categories: [CATEGORY, CATEGORY_2, archived('x1'), archived('x2')],
      }),
    });
    const tiles = budgetCategoryTiles(shared, { id: held.id, heldIds: held.categoryIds });
    expect(tiles.map((tile) => [tile.id, tile.taken, tile.archived])).toEqual([
      [CATEGORY.id, false, false],
      [CATEGORY_2.id, true, false],
      ['x1', false, true],
    ]);
  });
});

describe('budgetPrefillFrom', () => {
  const archived = categorySchema.parse({
    ...CATEGORY_2,
    id: 'x1',
    archivedAt: '2026-09-01T00:00:00.000Z',
  });
  const data = dataWith([], {
    budgets: [BUDGET],
    categories: [CATEGORY, CATEGORY_2, CATEGORY_CHILD, archived],
  });

  it('takes a free live top-level category and a whole amount in minor units', () => {
    expect(budgetPrefillFrom({ category: CATEGORY_2.id, amount: '75050' }, data, 'EUR')).toEqual({
      categoryIds: [CATEGORY_2.id],
      amount: '750.5',
    });
  });

  it('drops what the URL got wrong: a taken, archived, child or unknown category, a bad amount', () => {
    for (const category of [CATEGORY.id, archived.id, CATEGORY_CHILD.id, 'nope']) {
      expect(budgetPrefillFrom({ category, amount: '100' }, data, 'EUR')?.categoryIds).toEqual([]);
    }
    for (const amount of ['abc', '-5', '0', '1.5', '12345678901234567890']) {
      expect(budgetPrefillFrom({ category: CATEGORY_2.id, amount }, data, 'EUR')?.amount).toBe(
        undefined,
      );
    }
    expect(budgetPrefillFrom({ category: 'nope', amount: 'abc' }, data, 'EUR')).toBeUndefined();
  });
});
