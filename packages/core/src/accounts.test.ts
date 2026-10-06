import { describe, expect, it } from 'vitest';
import { ACCOUNTS, aprilTransactions, TODAY, tx } from './__tests__/fixtures';
import {
  type AccountRef,
  accountBalances,
  creditCardDue,
  creditChargeReminders,
  creditSettlementDraft,
  creditStatementAccrued,
  creditStatementDue,
  fillsFromBalances,
  nextCreditChargeDate,
  previewFromBalances,
  transferBalancePreview,
  transferFillAmounts,
  transferOverdrawsSource,
  transferOverpaysCard,
} from './accounts';

describe('accountBalances', () => {
  const balances = accountBalances(ACCOUNTS, aprilTransactions(), TODAY);

  it('applies income, expenses and both legs of a transfer', () => {
    expect(balances.get('acc-checking')).toBe(603000);
    expect(balances.get('acc-savings')).toBe(1050000);
  });

  it('counts excluded transactions, unlike the cycle totals', () => {
    // 1000 + 6240 + 2000 + 9000, where the 9000 has excludeFromTotals: true.
    expect(balances.get('acc-card')).toBe(-18240);
  });

  it('ignores transactions dated after today', () => {
    const withFuture = accountBalances(
      ACCOUNTS,
      [tx({ date: '2026-04-20', amount: 5000, accountId: 'acc-checking' })],
      TODAY,
    );
    expect(withFuture.get('acc-checking')).toBe(500000);
  });
});

describe('credit card', () => {
  it('accrues card expenses since the last close day', () => {
    // Close day 20, today 18 Apr, so the statement period is 21 Mar - 18 Apr.
    expect(creditStatementAccrued('acc-card', 20, aprilTransactions(), TODAY)).toBe(18240);
  });

  it('excludes expenses of the closed statement', () => {
    const txs = [
      tx({ date: '2026-03-20', amount: 1000, accountId: 'acc-card' }),
      tx({ date: '2026-03-21', amount: 500, accountId: 'acc-card' }),
    ];
    expect(creditStatementAccrued('acc-card', 20, txs, TODAY)).toBe(500);
  });

  it('reports what is due only when the card is in debt', () => {
    expect(creditCardDue(-18240)).toBe(18240);
    expect(creditCardDue(0)).toBe(0);
    expect(creditCardDue(5000)).toBe(0);
  });

  it('finds the next charge date after today', () => {
    expect(nextCreditChargeDate(5, TODAY)).toBe('2026-05-05');
    expect(nextCreditChargeDate(20, TODAY)).toBe('2026-04-20');
    expect(nextCreditChargeDate(18, TODAY)).toBe('2026-05-18');
    expect(nextCreditChargeDate(31, '2026-01-31')).toBe('2026-02-28');
  });
});

describe('transferBalancePreview', () => {
  const draft = {
    id: 'draft',
    amount: 50000,
    date: TODAY,
    fromAccountId: 'acc-checking',
    toAccountId: 'acc-savings',
  };

  it('does not count the row being edited twice', () => {
    const rows = aprilTransactions();
    const saved = rows.find((tx) => tx.kind === 'transfer');
    expect(saved).toBeDefined();
    if (saved === undefined) return;
    // The saved transfer already moved 50000; raising it to 60000 must move 10000 more, not 60000.
    const preview = transferBalancePreview(ACCOUNTS, rows, TODAY, {
      ...draft,
      id: saved.id,
      amount: 60000,
    });
    expect(preview.from).toEqual({ now: 603000, after: 593000 });
    expect(preview.to).toEqual({ now: 1050000, after: 1060000 });
  });

  it('leaves the balances alone for a transfer dated in the future', () => {
    const preview = transferBalancePreview(ACCOUNTS, aprilTransactions(), TODAY, {
      ...draft,
      date: '2026-04-30',
    });
    expect(preview.from).toEqual({ now: 603000, after: 603000 });
    expect(preview.to).toEqual({ now: 1050000, after: 1050000 });
  });
});

describe('previewFromBalances', () => {
  it('agrees with transferBalancePreview', () => {
    const A = ACCOUNTS;
    const T = aprilTransactions();
    const saved = T.find((row) => row.kind === 'transfer');
    if (saved === undefined) throw new Error('fixture must include a transfer');
    const drafts = [
      {
        id: 'draft-past',
        amount: 20000,
        date: '2026-04-10',
        fromAccountId: 'acc-checking',
        toAccountId: 'acc-savings',
      },
      {
        id: 'draft-future',
        amount: 20000,
        date: '2026-04-30',
        fromAccountId: 'acc-checking',
        toAccountId: 'acc-savings',
      },
      {
        id: saved.id,
        amount: saved.amount + 10000,
        date: saved.date,
        fromAccountId: saved.accountId,
        toAccountId: saved.toAccountId,
      },
      {
        id: saved.id,
        amount: saved.amount,
        date: '2026-04-30',
        fromAccountId: saved.accountId,
        toAccountId: saved.toAccountId,
      },
    ];
    const now = accountBalances(A, T, TODAY);
    for (const draft of drafts) {
      const without = accountBalances(
        A,
        T.filter((row) => row.id !== draft.id),
        TODAY,
      );
      expect(previewFromBalances(now, without, draft, TODAY)).toEqual(
        transferBalancePreview(A, T, TODAY, draft),
      );
    }
  });
});

describe('fillsFromBalances', () => {
  it('offers the whole balance, and what an open goal lacks when it is less', () => {
    const accounts = [
      { id: 'a', type: 'checking' as const, archivedAt: null, goalTarget: null },
      { id: 'g', type: 'pocket' as const, archivedAt: null, goalTarget: 50000 },
    ];
    const balances = new Map([
      ['a', 100000],
      ['g', 20000],
    ]);
    expect(fillsFromBalances(accounts, balances, { fromAccountId: 'a', toAccountId: 'g' })).toEqual(
      [
        { key: 'balance', minor: 100000 },
        { key: 'missing', minor: 30000 },
      ],
    );
  });
});

describe('transferOverdrawsSource', () => {
  const checking = { type: 'checking' } as const;

  it('catches a transfer that takes the account below zero', () => {
    expect(transferOverdrawsSource(checking, { now: 5000, after: -1000 })).toBe(true);
  });

  it('lets through a transfer the account can cover, down to the last cent', () => {
    expect(transferOverdrawsSource(checking, { now: 5000, after: 0 })).toBe(false);
    expect(transferOverdrawsSource(checking, { now: 5000, after: 1 })).toBe(false);
  });

  it('exempts a credit card, whose balance is negative by design', () => {
    expect(transferOverdrawsSource({ type: 'credit_card' }, { now: -5000, after: -6000 })).toBe(
      false,
    );
  });
});

/** `acc-card` closes on the 20th and is charged on the 5th. */
const CARD = ACCOUNTS[0] as AccountRef;
const spend = (date: string, amount: number) => tx({ date, amount, accountId: 'acc-card' });
const pay = (date: string, amount: number) =>
  tx({
    date,
    amount,
    kind: 'transfer',
    accountId: 'acc-checking',
    toAccountId: 'acc-card',
    categoryId: null,
  });
const refund = (date: string, amount: number) =>
  tx({ date, amount, kind: 'income', accountId: 'acc-card', categoryId: 'cat-salary' });

describe('creditStatementDue', () => {
  it('owes the balance at the last close day, charged on the next charge day', () => {
    const txs = [spend('2026-03-10', 30000), spend('2026-03-20', 2000), spend('2026-04-01', 5000)];
    expect(creditStatementDue(CARD, txs, TODAY)).toEqual({
      closeDate: '2026-03-20',
      chargeDate: '2026-04-05',
      statement: 32000,
      due: 32000,
    });
  });

  it('counts a payment made before the close in the statement itself', () => {
    const txs = [spend('2026-03-10', 30000), pay('2026-03-15', 30000), spend('2026-03-25', 5000)];
    expect(creditStatementDue(CARD, txs, TODAY)?.due).toBe(0);
  });

  it('subtracts a partial payment made after the close', () => {
    const txs = [spend('2026-03-10', 30000), pay('2026-04-02', 10000)];
    expect(creditStatementDue(CARD, txs, TODAY)?.due).toBe(20000);
  });

  it('counts a payment already scheduled for the charge day', () => {
    const txs = [spend('2026-03-10', 30000), pay('2026-04-05', 30000)];
    expect(creditStatementDue(CARD, txs, '2026-03-25')?.due).toBe(0);
  });

  it('counts a payment made after the charge day, until the next close', () => {
    const txs = [spend('2026-03-10', 30000), pay('2026-04-10', 30000)];
    expect(creditStatementDue(CARD, txs, TODAY)?.due).toBe(0);
  });

  it('keeps a refund after the close for the next statement, unless the card owes less', () => {
    const withSpending = [
      spend('2026-03-10', 30000),
      spend('2026-04-01', 20000),
      refund('2026-04-02', 10000),
    ];
    expect(creditStatementDue(CARD, withSpending, TODAY)?.due).toBe(30000);
    const refundOnly = [spend('2026-03-10', 30000), refund('2026-04-02', 10000)];
    expect(creditStatementDue(CARD, refundOnly, TODAY)?.due).toBe(20000);
  });

  it('counts a refund before the close in the statement', () => {
    const txs = [spend('2026-03-10', 30000), refund('2026-03-12', 10000)];
    expect(creditStatementDue(CARD, txs, TODAY)?.statement).toBe(20000);
  });

  it('owes nothing when the card was in credit at the close', () => {
    const txs = [spend('2026-03-10', 1000), pay('2026-03-12', 5000)];
    expect(creditStatementDue(CARD, txs, TODAY)).toMatchObject({ statement: 0, due: 0 });
  });

  it('never owes more than the card owes today', () => {
    const txs = [spend('2026-03-10', 30000), pay('2026-04-02', 50000)];
    expect(creditStatementDue(CARD, txs, TODAY)?.due).toBe(0);
  });

  it('closes today on the close day', () => {
    expect(creditStatementDue(CARD, [spend('2026-04-20', 1000)], '2026-04-20')).toMatchObject({
      closeDate: '2026-04-20',
      chargeDate: '2026-05-05',
      statement: 1000,
    });
  });
});

describe('creditSettlementDraft', () => {
  const card = { ...CARD, creditPaymentAccountId: 'acc-checking' };

  it('pays the statement from the payment account on the charge day', () => {
    const txs = [spend('2026-04-10', 30000), spend('2026-04-22', 5000)];
    expect(creditSettlementDraft(card, ACCOUNTS, txs, '2026-04-25')).toEqual({
      fromAccountId: 'acc-checking',
      toAccountId: 'acc-card',
      statementAmount: 30000,
      balanceAmount: 35000,
      amount: 30000,
      date: '2026-05-05',
      statementDate: '2026-04-20',
    });
  });

  it('pays an overdue statement today', () => {
    const txs = [spend('2026-03-10', 30000)];
    expect(creditSettlementDraft(card, ACCOUNTS, txs, TODAY)).toMatchObject({
      amount: 30000,
      date: TODAY,
    });
  });

  it('offers the whole balance, today, once the statement is paid', () => {
    const txs = [spend('2026-04-01', 5000)];
    expect(creditSettlementDraft(card, ACCOUNTS, txs, TODAY)).toMatchObject({
      statementAmount: 0,
      balanceAmount: 5000,
      amount: 5000,
      date: TODAY,
    });
  });
});

describe('creditChargeReminders', () => {
  it('includes the charge day itself', () => {
    expect(
      creditChargeReminders(ACCOUNTS, [spend('2026-04-10', 30000)], '2026-05-05'),
    ).toHaveLength(1);
  });

  it('skips a paid statement and a charge day already past', () => {
    const paid = [spend('2026-04-10', 30000), pay('2026-05-05', 30000)];
    expect(creditChargeReminders(ACCOUNTS, paid, '2026-04-25')).toEqual([]);
    expect(creditChargeReminders(ACCOUNTS, [spend('2026-03-10', 30000)], TODAY)).toEqual([]);
  });
});

describe('transferOverpaysCard', () => {
  const card = { type: 'credit_card' } as const;

  it('lets a card be paid off exactly, or stay in debt', () => {
    expect(transferOverpaysCard(card, { now: -5000, after: 0 })).toBe(false);
    expect(transferOverpaysCard(card, { now: -5000, after: -1000 })).toBe(false);
  });
});

describe('transferFillAmounts', () => {
  const draft = { id: 'draft', fromAccountId: 'acc-checking', toAccountId: 'acc-savings' };
  const goal = {
    id: 'goal-car',
    type: 'pocket' as const,
    openingBalance: 100000,
    includeInSpendable: false,
    archivedAt: null,
    creditCloseDay: null,
    creditChargeDay: null,
    goalTarget: 300000,
  };

  it('offers a card only the credit it holds', () => {
    const fromCard = { ...draft, fromAccountId: 'acc-card', toAccountId: 'acc-checking' };
    // In debt (-18240): nothing to move.
    expect(transferFillAmounts(ACCOUNTS, aprilTransactions(), TODAY, fromCard)).toEqual([]);
    const refund = [tx({ date: TODAY, kind: 'income', amount: 4000, accountId: 'acc-card' })];
    expect(transferFillAmounts(ACCOUNTS, refund, TODAY, fromCard)).toEqual([
      { key: 'balance', minor: 4000 },
    ]);
  });

  it('leaves the transfer being edited out, so re-editing offers the same total', () => {
    const saved = tx({
      date: TODAY,
      id: 'draft',
      kind: 'transfer',
      amount: 50000,
      accountId: 'acc-checking',
      toAccountId: 'acc-savings',
    });
    expect(transferFillAmounts(ACCOUNTS, [saved], TODAY, draft)).toEqual([
      { key: 'balance', minor: 500000 },
    ]);
  });

  it('ignores rows dated after today', () => {
    const later = [tx({ date: '2026-04-20', amount: 5000, accountId: 'acc-checking' })];
    expect(transferFillAmounts(ACCOUNTS, later, TODAY, draft)).toEqual([
      { key: 'balance', minor: 500000 },
    ]);
  });

  describe('into a goal', () => {
    const accounts = [...ACCOUNTS, goal];
    const toGoal = { ...draft, toAccountId: 'goal-car' };

    it('also offers what the goal still lacks, when it is less than the whole balance', () => {
      expect(transferFillAmounts(accounts, [], TODAY, toGoal)).toEqual([
        { key: 'balance', minor: 500000 },
        { key: 'missing', minor: 200000 },
      ]);
    });

    it('counts what the goal has received', () => {
      const put = [
        tx({
          date: TODAY,
          kind: 'transfer',
          amount: 50000,
          accountId: 'acc-checking',
          toAccountId: 'goal-car',
        }),
      ];
      expect(transferFillAmounts(accounts, put, TODAY, toGoal)).toEqual([
        { key: 'balance', minor: 450000 },
        { key: 'missing', minor: 150000 },
      ]);
    });

    it('drops the second chip when the source cannot cover the gap: both would fill the same', () => {
      const poor = { ...goal, id: 'acc-poor', type: 'checking' as const, openingBalance: 150000 };
      expect(
        transferFillAmounts([poor, goal], [], TODAY, { ...toGoal, fromAccountId: 'acc-poor' }),
      ).toEqual([{ key: 'balance', minor: 150000 }]);
    });
  });
});
