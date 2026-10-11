import { type Budget, budgetSchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { CATEGORY, CATEGORY_2, CATEGORY_CHILD, dataWith, tx } from '../test/fixtures';
import { budgetFormShared } from './formView';

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
