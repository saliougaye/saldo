import { describe, expect, it } from 'vitest';
import {
  BUDGET_ALERT_THRESHOLDS,
  budgetSchema,
  entitySchemas,
  recurrenceSchema,
  settingsSchema,
  type Transaction,
  transactionSchema,
} from './entities';

const meta = {
  id: '0191e0b2-0000-7000-8000-000000000001',
  createdAt: '2026-04-18T10:00:00.000Z',
  updatedAt: '001776506400000-0000-device1',
  deletedAt: null,
};

const expense: Transaction = {
  ...meta,
  kind: 'expense',
  amount: 4500,
  date: '2026-04-18',
  accountId: 'acc-card',
  toAccountId: null,
  categoryId: 'cat-fuel',
  description: 'Benzina Q8',
  note: null,
  tagIds: [],
  excludeFromTotals: false,
  recurrenceId: null,
};

function issuePaths(input: unknown): string[] {
  const result = transactionSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join('.'));
}

describe('transactionSchema', () => {
  it('accepts a valid expense', () => {
    expect(transactionSchema.safeParse(expense).success).toBe(true);
  });

  it('requires a category for expenses and income', () => {
    expect(issuePaths({ ...expense, categoryId: null })).toContain('categoryId');
  });

  it('requires a different destination and no category for transfers', () => {
    const transfer = { ...expense, kind: 'transfer', categoryId: null, toAccountId: 'acc-savings' };
    expect(transactionSchema.safeParse(transfer).success).toBe(true);
    expect(issuePaths({ ...transfer, toAccountId: 'acc-card' })).toContain('toAccountId');
    expect(issuePaths({ ...transfer, categoryId: 'cat-fuel' })).toContain('categoryId');
  });

  it('rejects zero amounts and impossible dates', () => {
    expect(transactionSchema.safeParse({ ...expense, amount: 0 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...expense, amount: 12.5 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...expense, date: '2026-02-30' }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...expense, date: '2026-4-18' }).success).toBe(false);
  });

  it('requires sync timestamps to be ISO-8601 instants in UTC', () => {
    expect(
      transactionSchema.safeParse({ ...expense, createdAt: '2026-04-18T10:00:00Z' }).success,
    ).toBe(true);
    for (const createdAt of [
      '2026-04-18T10:00:00+02:00',
      '2026-04-18T10:00:00',
      '2026-04-18T10:00',
      '2026-02-30T10:00:00.000Z',
      '2026-04-18',
    ]) {
      expect(transactionSchema.safeParse({ ...expense, createdAt }).success).toBe(false);
    }
  });
});

describe('settingsSchema', () => {
  const settings = {
    ...meta,
    id: 'settings',
    cycleStartDay: 27,
    currency: 'EUR',
    language: 'system',
    theme: 'dark',
    onboardingCompletedAt: null,
  };

  it('accepts valid settings and rejects out of range start days', () => {
    expect(settingsSchema.safeParse(settings).success).toBe(true);
    expect(settingsSchema.safeParse({ ...settings, cycleStartDay: 32 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, id: 'other' }).success).toBe(false);
  });

  it('accepts every supported currency and rejects unknown codes', () => {
    expect(settingsSchema.safeParse({ ...settings, currency: 'JPY' }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...settings, currency: 'KWD' }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...settings, currency: 'XYZ' }).success).toBe(false);
  });
});

describe('recurrenceSchema', () => {
  const recurrence = {
    ...meta,
    frequency: 'monthly',
    startDate: '2026-04-20',
    endDate: null,
    template: {
      kind: 'expense',
      amount: 990,
      accountId: 'acc-card',
      toAccountId: null,
      categoryId: 'cat-subscriptions',
      description: 'Netflix',
      tagIds: [],
      excludeFromTotals: false,
    },
  };

  it('accepts a valid monthly recurrence', () => {
    expect(recurrenceSchema.safeParse(recurrence).success).toBe(true);
  });

  it('holds the template to the same rules as a transaction', () => {
    const withoutCategory = {
      ...recurrence,
      template: { ...recurrence.template, categoryId: null },
    };
    expect(recurrenceSchema.safeParse(withoutCategory).success).toBe(false);

    const selfTransfer = {
      ...recurrence,
      template: {
        ...recurrence.template,
        kind: 'transfer',
        categoryId: null,
        toAccountId: 'acc-card',
      },
    };
    expect(recurrenceSchema.safeParse(selfTransfer).success).toBe(false);

    const transfer = {
      ...recurrence,
      template: {
        ...recurrence.template,
        kind: 'transfer',
        categoryId: null,
        toAccountId: 'acc-savings',
      },
    };
    expect(recurrenceSchema.safeParse(transfer).success).toBe(true);
  });
});

describe('budgetSchema', () => {
  const budget = {
    ...meta,
    name: 'Spesa',
    categoryIds: ['cat-groceries'],
    amount: 42000,
    period: 'cycle',
    alertThreshold: 90,
    rollover: false,
    icon: 'cart',
    sortOrder: 0,
  };

  it('accepts any percentage as the alert threshold', () => {
    expect(budgetSchema.safeParse(budget).success).toBe(true);
    expect(budgetSchema.safeParse({ ...budget, alertThreshold: null }).success).toBe(true);
    expect(budgetSchema.safeParse({ ...budget, alertThreshold: 80 }).success).toBe(true);
    for (const threshold of BUDGET_ALERT_THRESHOLDS) {
      expect(budgetSchema.safeParse({ ...budget, alertThreshold: threshold }).success).toBe(true);
    }
  });

  it('rejects thresholds outside 1-100 and empty category lists', () => {
    expect(budgetSchema.safeParse({ ...budget, alertThreshold: 0 }).success).toBe(false);
    expect(budgetSchema.safeParse({ ...budget, alertThreshold: 101 }).success).toBe(false);
    expect(budgetSchema.safeParse({ ...budget, alertThreshold: 90.5 }).success).toBe(false);
    expect(budgetSchema.safeParse({ ...budget, categoryIds: [] }).success).toBe(false);
  });
});

describe('entitySchemas', () => {
  it('lists every synced entity', () => {
    expect(Object.keys(entitySchemas).sort()).toEqual([
      'account',
      'attachment',
      'budget',
      'category',
      'recurrence',
      'settings',
      'tag',
      'transaction',
    ]);
  });
});
