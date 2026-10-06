import { describe, expect, it } from 'vitest';
import type { Budget, Category } from '../../entities';
import { categoryArchiveRequest, resolveCategoryInput } from './categories';

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

const own: Budget = {
  id: 'bud-food',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: 'hlc-bud',
  deletedAt: null,
  name: 'Spesa',
  categoryIds: ['cat-food'],
  amount: 30000,
  period: 'period',
  alertThreshold: 90,
  rollover: false,
  icon: 'cart',
  sortOrder: 0,
};

describe('resolveCategoryInput', () => {
  it('keeps the budget it has when monthlyBudgetMinor is left out', () => {
    const result = resolveCategoryInput(
      { id: 'cat-food', updatedAt: 'hlc-food', name: 'Alimentari' },
      food,
      [own],
      2,
    );
    expect(result.ok && result.value).toMatchObject({
      name: 'Alimentari',
      icon: 'cart',
      colorIndex: 3,
      budgetEnabled: true,
      budgetBuffer: '300',
      expectedUpdatedAt: 'hlc-food',
    });
  });

  it('removes the budget with null or 0', () => {
    for (const monthlyBudgetMinor of [null, 0]) {
      const result = resolveCategoryInput(
        { id: 'cat-food', updatedAt: 'hlc-food', monthlyBudgetMinor },
        food,
        [own],
        2,
      );
      expect(result.ok && result.value).toMatchObject({ budgetEnabled: false, budgetBuffer: '' });
    }
  });

  it('never changes the direction, and gives income no budget', () => {
    expect(
      resolveCategoryInput(
        { id: 'cat-food', updatedAt: 'hlc-food', direction: 'income' },
        food,
        [],
        2,
      ).ok,
    ).toBe(false);
    expect(
      resolveCategoryInput(
        { name: 'Stipendio', direction: 'income', monthlyBudgetMinor: 100 },
        null,
        [],
        2,
      ).ok,
    ).toBe(false);
  });
});

describe('categoryArchiveRequest', () => {
  it('archives with or without a move, and restores without one', () => {
    expect(
      categoryArchiveRequest({ id: 'c', updatedAt: 'h', action: 'archive', moveToId: 'd' }),
    ).toEqual({ ok: true, value: { action: 'archive', moveToId: 'd' } });
    expect(categoryArchiveRequest({ id: 'c', updatedAt: 'h', action: 'archive' })).toEqual({
      ok: true,
      value: { action: 'archive', moveToId: null },
    });
    expect(categoryArchiveRequest({ id: 'c', updatedAt: 'h', action: 'restore' })).toEqual({
      ok: true,
      value: { action: 'restore' },
    });
    expect(
      categoryArchiveRequest({ id: 'c', updatedAt: 'h', action: 'restore', moveToId: 'd' }).ok,
    ).toBe(false);
  });
});
