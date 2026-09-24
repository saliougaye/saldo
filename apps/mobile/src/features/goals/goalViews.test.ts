import type { Account, Transaction } from '@saldo/core';
import { goalViews } from './goalViews';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '1',
  deletedAt: null,
  institution: null,
  openingBalance: 0,
  colorIndex: 0,
  icon: 'car',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  sortOrder: 0,
};

const checking: Account = {
  ...meta,
  id: 'checking',
  name: 'Conto',
  type: 'checking',
  includeInSpendable: true,
  archivedAt: null,
};

const pocket = (id: string, archivedAt: string | null = null): Account => ({
  ...meta,
  id,
  name: id,
  type: 'pocket',
  includeInSpendable: false,
  archivedAt,
  parentAccountId: 'checking',
  goalTarget: 100_000,
  goalDeadline: null,
  goalStartDate: '2026-01-01',
});

const transfer: Transaction = {
  id: 't1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '1',
  deletedAt: null,
  kind: 'transfer',
  amount: 40_000,
  date: '2026-02-01',
  accountId: 'checking',
  toAccountId: 'car',
  categoryId: null,
  description: '',
  note: null,
  tagIds: [],
  excludeFromTotals: false,
  recurrenceId: null,
};

describe('goalViews', () => {
  it('measures every open pocket and names its parent', () => {
    const views = goalViews(
      [checking, pocket('car'), pocket('sofa', '2026-05-01T00:00:00.000Z')],
      [transfer],
      '2026-09-24',
      { kind: 'month', startDay: 1 },
    );
    expect(views.map((view) => view.account.id)).toEqual(['car']);
    expect(views[0]?.parent?.name).toBe('Conto');
    expect(views[0]?.progress.saved).toBe(40_000);
  });
});
