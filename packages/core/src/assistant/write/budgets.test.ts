import { describe, expect, it } from 'vitest';
import type { Budget, Category } from '../../entities';
import { deleteBudgetTool, resolveBudgetInput, saveBudgetInput } from './budgets';

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

describe('saveBudgetInput', () => {
  it('takes only the alert thresholds the form offers', () => {
    expect(saveBudgetInput.safeParse({ alertThreshold: 90 }).success).toBe(true);
    expect(saveBudgetInput.safeParse({ alertThreshold: null }).success).toBe(true);
    expect(saveBudgetInput.safeParse({ alertThreshold: 80 }).success).toBe(false);
  });
});

describe('resolveBudgetInput', () => {
  it('creates from the form defaults, with its first category\'s icon', () => {
    expect(
      resolveBudgetInput(
        { name: 'Spesa', categoryIds: ['cat-food'], amountMinor: 30000 },
        null,
        [food],
        2,
      ),
    ).toEqual({
      ok: true,
      value: {
        id: null,
        name: 'Spesa',
        categoryIds: ['cat-food'],
        buffer: '300',
        period: 'period',
        alertThreshold: 90,
        rollover: false,
        icon: 'cart',
        expectedUpdatedAt: undefined,
      },
    });
  });

  it('needs a name to create', () => {
    expect(resolveBudgetInput({ categoryIds: ['cat-food'], amountMinor: 1 }, null, [food], 2).ok).toBe(
      false,
    );
  });

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

  it('marks delete_budget destructive', () => {
    expect(deleteBudgetTool.annotations.destructiveHint).toBe(true);
  });
});
