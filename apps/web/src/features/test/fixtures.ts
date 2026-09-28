import {
  type Account,
  type Attachment,
  accountSchema,
  attachmentSchema,
  type Category,
  categorySchema,
  emptyUserData,
  type Recurrence,
  recurrenceSchema,
  type Tag,
  type Transaction,
  tagSchema,
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

export const ACCOUNT_2: Account = accountSchema.parse({
  ...ACCOUNT,
  id: 'a2',
  name: 'Risparmi',
  type: 'savings',
  colorIndex: 3,
  icon: 'piggy',
  sortOrder: 1,
});

export const TAG: Tag = tagSchema.parse({
  id: 'g1',
  name: 'Vacanza',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z-0000-web',
  deletedAt: null,
});

export const RECURRENCE: Recurrence = recurrenceSchema.parse({
  id: 'r1',
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-01-10',
  endDate: '2026-12-10',
  template: {
    kind: 'expense',
    amount: 500,
    accountId: 'a1',
    toAccountId: null,
    categoryId: 'c1',
    description: '',
    tagIds: [],
    excludeFromTotals: false,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z-0000-web',
  deletedAt: null,
});

export function attachment(id: string, transactionId: string): Attachment {
  return attachmentSchema.parse({
    id,
    transactionId,
    mimeType: 'image/jpeg',
    byteSize: 1024,
    sha256: 'a'.repeat(64),
    width: 100,
    height: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z-0000-web',
    deletedAt: null,
  });
}

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

/** The two accounts, the two categories and whatever else a test needs on top (tags, recurrences…). */
export function dataWith(transactions: Transaction[], over: Partial<UserData> = {}): UserData {
  return {
    ...emptyUserData(),
    transactions,
    accounts: [ACCOUNT, ACCOUNT_2],
    categories: [CATEGORY, CATEGORY_2],
    ...over,
  };
}
