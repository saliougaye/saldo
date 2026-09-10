import type { AccountRef } from '../accounts';
import type { CategoryRef, LedgerTx } from '../ledger';

let sequence = 0;

export function tx(overrides: Partial<LedgerTx> & Pick<LedgerTx, 'date' | 'amount'>): LedgerTx {
  sequence += 1;
  return {
    id: `t${sequence}`,
    kind: 'expense',
    accountId: 'acc-card',
    toAccountId: null,
    categoryId: 'cat-groceries',
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
    description: '',
    ...overrides,
  };
}

/** Cycle 27 Mar – 26 Apr 2026, today 18 Apr (day 23 of 31), as in the design prototype. */
export const APRIL_CYCLE = { start: '2026-03-27', end: '2026-04-26' };
export const TODAY = '2026-04-18';

export const CATEGORIES: CategoryRef[] = [
  { id: 'cat-groceries', parentId: null },
  { id: 'cat-supermarket', parentId: 'cat-groceries' },
  { id: 'cat-home', parentId: null },
  { id: 'cat-rent', parentId: 'cat-home' },
  { id: 'cat-health', parentId: null },
  { id: 'cat-transport', parentId: null },
  { id: 'cat-salary', parentId: null },
];

export const ACCOUNTS: AccountRef[] = [
  {
    id: 'acc-card',
    type: 'credit_card',
    openingBalance: 0,
    includeInSpendable: false,
    archivedAt: null,
    creditCloseDay: 20,
    creditChargeDay: 5,
  },
  {
    id: 'acc-checking',
    type: 'checking',
    openingBalance: 500000,
    includeInSpendable: true,
    archivedAt: null,
    creditCloseDay: null,
    creditChargeDay: null,
  },
  {
    id: 'acc-savings',
    type: 'savings',
    openingBalance: 1000000,
    includeInSpendable: false,
    archivedAt: null,
    creditCloseDay: null,
    creditChargeDay: null,
  },
  {
    id: 'acc-old',
    type: 'cash',
    openingBalance: 20000,
    includeInSpendable: true,
    archivedAt: '2026-01-31T12:00:00.000Z',
    creditCloseDay: null,
    creditChargeDay: null,
  },
];

export function aprilTransactions(): LedgerTx[] {
  return [
    tx({ date: '2026-03-26', amount: 1000, categoryId: 'cat-groceries' }),
    tx({
      date: '2026-03-27',
      amount: 231000,
      kind: 'income',
      categoryId: 'cat-salary',
      accountId: 'acc-checking',
    }),
    tx({
      date: '2026-03-27',
      amount: 78000,
      categoryId: 'cat-rent',
      accountId: 'acc-checking',
      recurrenceId: 'rec-rent',
    }),
    tx({ date: '2026-03-27', amount: 6240, categoryId: 'cat-supermarket' }),
    tx({
      date: '2026-04-01',
      amount: 50000,
      kind: 'transfer',
      categoryId: null,
      accountId: 'acc-checking',
      toAccountId: 'acc-savings',
    }),
    tx({ date: '2026-04-02', amount: 2000, categoryId: 'cat-groceries' }),
    tx({ date: '2026-04-07', amount: 9000, categoryId: 'cat-health', excludeFromTotals: true }),
    tx({
      date: '2026-04-20',
      amount: 7800,
      categoryId: 'cat-transport',
      recurrenceId: 'rec-insurance',
    }),
  ];
}
