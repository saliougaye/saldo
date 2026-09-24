import { describe, expect, it } from 'vitest';
import {
  accountSchema,
  accountTypeSchema,
  BUDGET_ALERT_THRESHOLDS,
  budgetSchema,
  categorySchema,
  entitySchemas,
  MAX_COLOR_INDEX,
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
    periodKind: 'cycle',
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

  it('accepts every language the app speaks', () => {
    for (const language of ['system', 'it', 'en', 'fr', 'de', 'sv', 'es', 'pt']) {
      expect(settingsSchema.safeParse({ ...settings, language }).success).toBe(true);
    }
    expect(settingsSchema.safeParse({ ...settings, language: 'nl' }).success).toBe(false);
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

  it('accepts every N days, weeks, months or years, and defaults the interval to 1', () => {
    for (const frequency of ['daily', 'weekly', 'monthly', 'yearly']) {
      const parsed = recurrenceSchema.safeParse({ ...recurrence, frequency, interval: 3 });
      expect(parsed.success).toBe(true);
    }
    const legacy = recurrenceSchema.safeParse(recurrence);
    expect(legacy.success && legacy.data.interval).toBe(1);
  });

  it('rejects an interval below 1, above 99, or fractional', () => {
    for (const interval of [0, 100, 1.5, -1]) {
      expect(recurrenceSchema.safeParse({ ...recurrence, interval }).success).toBe(false);
    }
    expect(recurrenceSchema.safeParse({ ...recurrence, frequency: 'fortnightly' }).success).toBe(
      false,
    );
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
    period: 'period',
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

describe('accountTypeSchema', () => {
  it('knows a debit card, between a current account and a credit card, and ends with pockets', () => {
    expect(accountTypeSchema.options).toEqual([
      'cash',
      'checking',
      'debit_card',
      'credit_card',
      'savings',
      'investment',
      'pocket',
    ]);
  });
});

describe('colorIndex', () => {
  const category = {
    id: 'c1',
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '0000000000000-0000-a',
    deletedAt: null,
    name: 'Groceries',
    direction: 'expense' as const,
    parentId: null,
    icon: 'cart',
    archivedAt: null,
    sortOrder: 0,
  };

  it('accepts every swatch up to MAX_COLOR_INDEX', () => {
    expect(MAX_COLOR_INDEX).toBe(23);
    expect(categorySchema.safeParse({ ...category, colorIndex: 0 }).success).toBe(true);
    expect(categorySchema.safeParse({ ...category, colorIndex: MAX_COLOR_INDEX }).success).toBe(
      true,
    );
  });

  it('rejects an index beyond the palette', () => {
    expect(categorySchema.safeParse({ ...category, colorIndex: MAX_COLOR_INDEX + 1 }).success).toBe(
      false,
    );
  });
});

describe('accountSchema and pockets', () => {
  const base = {
    id: 'acc-1',
    createdAt: '2026-09-24T10:00:00.000Z',
    updatedAt: '0000000000000-0000-a',
    deletedAt: null,
    name: 'Macchina',
    institution: null,
    openingBalance: 0,
    colorIndex: 5,
    icon: 'car',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
  };
  const pocket = {
    ...base,
    type: 'pocket' as const,
    includeInSpendable: false,
    parentAccountId: 'acc-checking',
    goalTarget: 1_200_000,
    goalDeadline: '2027-06-30',
    goalStartDate: '2026-09-24',
  };

  it('accepts a pocket with its parent, target and start', () => {
    expect(accountSchema.safeParse(pocket).success).toBe(true);
  });

  it('accepts a pocket without a deadline', () => {
    expect(accountSchema.safeParse({ ...pocket, goalDeadline: null }).success).toBe(true);
  });

  it('refuses a pocket without a parent, a target or a start', () => {
    expect(accountSchema.safeParse({ ...pocket, parentAccountId: null }).success).toBe(false);
    expect(accountSchema.safeParse({ ...pocket, goalTarget: null }).success).toBe(false);
    expect(accountSchema.safeParse({ ...pocket, goalStartDate: null }).success).toBe(false);
  });

  it('refuses a spendable pocket and a deadline before the start', () => {
    expect(accountSchema.safeParse({ ...pocket, includeInSpendable: true }).success).toBe(false);
    expect(accountSchema.safeParse({ ...pocket, goalDeadline: '2026-09-01' }).success).toBe(false);
  });

  it('refuses goal fields on an account that is not a pocket', () => {
    const checking = { ...base, type: 'checking' as const, includeInSpendable: true };
    expect(accountSchema.safeParse({ ...checking, goalTarget: 1000 }).success).toBe(false);
    expect(accountSchema.safeParse({ ...checking, parentAccountId: 'acc-2' }).success).toBe(false);
  });

  it('parses a row written before the goal fields existed', () => {
    const checking = { ...base, type: 'checking' as const, includeInSpendable: true };
    expect(accountSchema.safeParse(checking).success).toBe(true);
  });
});
