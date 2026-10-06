import { describe, expect, it } from 'vitest';
import { accountSchema } from '../entities';
import { accountFormFrom, emptyAccountForm, openingBalanceFrom } from './accountForm';

const account = (patch: Record<string, unknown> = {}) =>
  accountSchema.parse({
    id: 'a1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    name: 'Conto',
    type: 'checking',
    institution: null,
    openingBalance: 1000,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
    ...patch,
  });

describe('a negative balance', () => {
  const card = account({ id: 'acc-card', type: 'credit_card', includeInSpendable: false });

  it('keeps its sign when an account is opened for editing', () => {
    expect(accountFormFrom(card, -41235, 2).buffer).toBe('-412.35');
  });

  it('is stored below zero on a new account', () => {
    const values = { ...emptyAccountForm(), buffer: '-412.35' };
    expect(openingBalanceFrom(values, 2, { accountId: null, txs: [], today: '2026-09-17' })).toBe(
      -41235,
    );
  });
});

describe('account form', () => {
  it('shows the current balance and stores the opening one', () => {
    const values = accountFormFrom(account(), 4200, 2);
    expect(values.buffer).toBe('42');
    const txs = [
      {
        id: 't1',
        kind: 'income' as const,
        amount: 500,
        date: '2026-02-01',
        accountId: 'a1',
        toAccountId: null,
        categoryId: null,
        description: '',
        tagIds: [],
        excludeFromTotals: false,
        recurrenceId: null,
      },
    ];
    // current 42.00 = opening + 5.00 income  ->  opening 37.00
    expect(openingBalanceFrom(values, 2, { accountId: 'a1', txs, today: '2026-03-01' })).toBe(3700);
    expect(openingBalanceFrom(values, 2, { accountId: null, txs, today: '2026-03-01' })).toBe(4200);
  });
});
