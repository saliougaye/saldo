import { describe, expect, it } from 'vitest';
import type { Budget, Category } from '../../entities';
import { resolveBudgetInput } from './budgets';

const food: Category = {
  id: 'cat-food',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: 'hlc-food',
  deletedAt: null,
  name: 'Spesa',
  direction: 'expense',
  parentId: null,
  icon: 'cart',
  colorIndex: 3,
  archivedAt: null,
  sortOrder: 0,
};

const stored: Budget = {
  id: 'bud-1',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: 'hlc-bud',
  deletedAt: null,
  name: 'Spesa',
  categoryIds: ['cat-food'],
  amount: 30000,
  period: 'month',
  alertThreshold: 75,
  rollover: false,
  icon: 'basket',
  sortOrder: 0,
};

describe('resolveBudgetInput', () => {
  it('changes only the given fields', () => {
    const result = resolveBudgetInput(
      { id: 'bud-1', updatedAt: 'hlc-bud', amountMinor: 35000 },
      stored,
      [food],
      2,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        id: 'bud-1',
        name: 'Spesa',
        categoryIds: ['cat-food'],
        buffer: '350',
        period: 'month',
        alertThreshold: 75,
        rollover: false,
        icon: 'basket',
        expectedUpdatedAt: 'hlc-bud',
      },
    });
  });
});
