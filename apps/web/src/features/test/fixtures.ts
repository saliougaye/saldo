import {
  type Account,
  accountSchema,
  type Category,
  categorySchema,
  emptyUserData,
  type Transaction,
  transactionSchema,
  type UserData,
} from '@saldo/core';

// The fixtures go through the schemas rather than through `as`: a row a test invents but the app
// could never store would make its assertions prove nothing (§17.1.2). They are shared by the
// feature tests so that the phone-shaped data every screen reads is described once.

export const ACCOUNT: Account = accountSchema.parse({
  id: 'a1',
  name: 'Conto',
  type: 'checking',
  institution: null,
  openingBalance: 0,
  includeInSpendable: true,
  colorIndex: 0,
  icon: 'wallet',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z-0000-web',
  deletedAt: null,
});

export const CATEGORY: Category = categorySchema.parse({
  id: 'c1',
  name: 'Spesa',
  direction: 'expense',
  parentId: null,
  icon: 'cart',
  colorIndex: 1,
  archivedAt: null,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z-0000-web',
  deletedAt: null,
});

export const CATEGORY_2: Category = categorySchema.parse({
  id: 'c2',
  name: 'Casa',
  direction: 'expense',
  parentId: null,
  icon: 'home',
  colorIndex: 2,
  archivedAt: null,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z-0000-web',
  deletedAt: null,
});

export function tx(
  over: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'date'>,
): Transaction {
  return transactionSchema.parse({
    kind: 'expense',
    accountId: ACCOUNT.id,
    toAccountId: null,
    categoryId: CATEGORY.id,
    description: '',
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z-0000-web',
    deletedAt: null,
    ...over,
  });
}

export function dataWith(transactions: Transaction[]): UserData {
  return {
    ...emptyUserData(),
    transactions,
    accounts: [ACCOUNT],
    categories: [CATEGORY, CATEGORY_2],
  };
}
