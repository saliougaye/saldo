import { budgetSchema, categorySchema, tagSchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { accountFormView, goalFormView } from './accounts/formView';
import { budgetFormView } from './budgets/formView';
import { archiveCategoryView } from './categories/archiveView';
import { categoryFormView } from './categories/formView';
import { tagsView } from './tags/tagsView';
import { ACCOUNT, account, CATEGORY, CATEGORY_2, dataWith, TAG, tx } from './test/fixtures';
import { detailView } from './transactions/detailView';
import { formView } from './transactions/formView';

const TODAY = '2026-09-20';
const STAMP = '2026-09-15T08:00:00.000Z-0003-phone';

const POCKET = account({
  id: 'p1',
  name: 'Vacanze',
  type: 'pocket',
  includeInSpendable: false,
  parentAccountId: ACCOUNT.id,
  goalTarget: 100000,
  goalStartDate: '2026-01-01',
  sortOrder: 2,
  updatedAt: STAMP,
});
const BUDGET = budgetSchema.parse({
  id: 'b1',
  name: 'Spesa',
  categoryIds: ['c1'],
  amount: 10000,
  period: 'period',
  alertThreshold: 90,
  rollover: false,
  icon: 'cart',
  sortOrder: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: STAMP,
  deletedAt: null,
});

const data = dataWith([tx({ id: 't1', amount: 500, date: '2026-09-10', updatedAt: STAMP })], {
  accounts: [account({ ...ACCOUNT, updatedAt: STAMP }), POCKET],
  categories: [categorySchema.parse({ ...CATEGORY, updatedAt: STAMP }), CATEGORY_2],
  tags: [tagSchema.parse({ ...TAG, updatedAt: STAMP })],
  budgets: [BUDGET],
});

describe('the web hands each edit the version it loaded (§17.4.2 «As built (0.4b)»)', () => {
  it('transactions: the form and the detail panel', () => {
    const edit = formView({ data, today: TODAY, currency: 'EUR', mode: 'edit', id: 't1' });
    expect(edit?.updatedAt).toBe(STAMP);
    const fresh = formView({ data, today: TODAY, currency: 'EUR', mode: 'new', id: null });
    expect(fresh?.updatedAt).toBeNull();
    expect(detailView({ data, id: 't1' })?.updatedAt).toBe(STAMP);
  });

  it('accounts and goals', () => {
    const base = { data, today: TODAY, currency: 'EUR' } as const;
    expect(accountFormView({ ...base, mode: 'edit', id: ACCOUNT.id })?.updatedAt).toBe(STAMP);
    expect(accountFormView({ ...base, mode: 'new', id: null })?.updatedAt).toBeNull();
    expect(goalFormView({ ...base, mode: 'edit', id: 'p1' })?.updatedAt).toBe(STAMP);
    expect(goalFormView({ ...base, mode: 'new', id: null })?.updatedAt).toBeNull();
  });

  it('budgets', () => {
    const base = {
      data,
      today: TODAY,
      def: { kind: 'month', startDay: 1 },
      period: {
        range: { start: '2026-09-01', end: '2026-09-30' },
        isCurrent: true,
        elapsed: 20,
        length: 30,
      },
      currency: 'EUR',
    } as const;
    expect(budgetFormView({ ...base, mode: 'edit', id: 'b1' })?.updatedAt).toBe(STAMP);
    expect(budgetFormView({ ...base, mode: 'new', id: null })?.updatedAt).toBeNull();
  });

  it('categories: the form and the archive dialog', () => {
    expect(
      categoryFormView({ data, currency: 'EUR', mode: 'edit', id: CATEGORY.id })?.updatedAt,
    ).toBe(STAMP);
    expect(
      categoryFormView({ data, currency: 'EUR', mode: 'new', id: null })?.updatedAt,
    ).toBeNull();
    expect(archiveCategoryView(data, CATEGORY.id)?.updatedAt).toBe(STAMP);
  });

  it('tags', () => {
    expect(tagsView(data).find((row) => row.id === TAG.id)?.updatedAt).toBe(STAMP);
  });
});
