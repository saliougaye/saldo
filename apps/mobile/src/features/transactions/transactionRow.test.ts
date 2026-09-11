import type { LedgerTx } from '@saldo/core';
import { NEUTRAL_COLOR_INDEX, type TransactionRowDeps, transactionRow } from './transactionRow';

const tx = (overrides: Partial<LedgerTx>): LedgerTx => ({
  id: 't1',
  kind: 'expense',
  amount: 5630,
  date: '2026-04-18',
  accountId: 'acc-checking',
  toAccountId: null,
  categoryId: 'cat-groceries',
  tagIds: [],
  excludeFromTotals: false,
  recurrenceId: null,
  description: '',
  ...overrides,
});

const CATEGORIES = {
  'cat-groceries': { name: 'Spesa', icon: 'cart', colorIndex: 2 },
};
const ACCOUNTS: Record<string, string> = {
  'acc-checking': 'Conto corrente',
  'acc-savings': 'Risparmi',
};

const deps = (overrides: Partial<TransactionRowDeps> = {}): TransactionRowDeps => ({
  category: (id) => CATEGORIES[id as keyof typeof CATEGORIES],
  accountName: (id) => ACCOUNTS[id] ?? '',
  kindLabel: (kind) => ({ expense: 'Uscita', income: 'Entrata', transfer: 'Trasferimento' })[kind],
  viewpointAccountId: null,
  ...overrides,
});

const transfer = tx({
  kind: 'transfer',
  amount: 50000,
  categoryId: null,
  accountId: 'acc-checking',
  toAccountId: 'acc-savings',
});

describe('transactionRow', () => {
  it('titles an expense with its description and names its category underneath', () => {
    expect(transactionRow(tx({ description: 'Esselunga' }), deps())).toMatchObject({
      title: 'Esselunga',
      subtitle: 'Spesa',
      icon: 'cart',
      colorIndex: 2,
    });
  });

  it('falls back to the category name when a transaction has no description', () => {
    expect(transactionRow(tx({}), deps())).toMatchObject({ title: 'Spesa', subtitle: 'Spesa' });
  });

  it('gives an uncategorised transaction the neutral tag row, never the transfer icon', () => {
    expect(transactionRow(tx({ categoryId: null }), deps())).toMatchObject({
      title: 'Uscita',
      icon: 'tag',
      colorIndex: NEUTRAL_COLOR_INDEX,
    });
  });

  it('titles a transfer with the two accounts it moves between (§4)', () => {
    expect(transactionRow(transfer, deps())).toMatchObject({
      title: 'Conto corrente → Risparmi',
      subtitle: 'Trasferimento',
      icon: 'swap',
      colorIndex: NEUTRAL_COLOR_INDEX,
    });
  });

  it('keeps a transfer description as the title and still names it underneath', () => {
    expect(transactionRow({ ...transfer, description: 'Giroconto' }, deps())).toMatchObject({
      title: 'Giroconto',
      subtitle: 'Trasferimento',
    });
  });

  it('renders a transfer unsigned and muted when no account frames the list', () => {
    expect(transactionRow(transfer, deps()).amount).toEqual({
      minor: 50000,
      signDisplay: 'never',
      muted: true,
    });
  });

  it('signs a transfer by the leg the viewpoint account is on', () => {
    expect(transactionRow(transfer, deps({ viewpointAccountId: 'acc-checking' })).amount).toEqual({
      minor: -50000,
      signDisplay: 'always',
      muted: false,
    });
    expect(transactionRow(transfer, deps({ viewpointAccountId: 'acc-savings' })).amount).toEqual({
      minor: 50000,
      signDisplay: 'always',
      muted: false,
    });
  });

  it('signs an expense down and an income up whatever the viewpoint', () => {
    expect(transactionRow(tx({}), deps()).amount).toEqual({
      minor: -5630,
      signDisplay: 'negative',
      muted: false,
    });
    expect(
      transactionRow(
        tx({ kind: 'income', categoryId: null }),
        deps({ viewpointAccountId: 'acc-checking' }),
      ).amount,
    ).toEqual({ minor: 5630, signDisplay: 'always', muted: false });
  });
});
