import { describe, expect, it } from 'vitest';
import { ACCOUNTS, APRIL_CYCLE, aprilTransactions, TODAY, tx } from './__tests__/fixtures';
import {
  type AccountRef,
  accountBalances,
  creditCardDue,
  creditChargeReminders,
  creditSettlementDraft,
  creditStatementAccrued,
  creditStatementDue,
  netWorth,
  nextCreditChargeDate,
  paymentAccountCandidates,
  spendableTotal,
  transferBalancePreview,
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

  it('starts every account from its opening balance', () => {
    expect(accountBalances(ACCOUNTS, [], TODAY).get('acc-old')).toBe(20000);
    expect([...accountBalances(ACCOUNTS, [], TODAY).keys()].sort()).toEqual([
      'acc-card',
      'acc-checking',
      'acc-old',
      'acc-savings',
    ]);
  });

  it('ignores transactions on unknown accounts', () => {
    const balances = accountBalances(
      ACCOUNTS,
      [tx({ date: TODAY, amount: 5000, accountId: 'acc-ghost' })],
      TODAY,
    );
    expect(balances.has('acc-ghost')).toBe(false);
  });
});

describe('spendableTotal / netWorth', () => {
  const balances = accountBalances(ACCOUNTS, aprilTransactions(), TODAY);

  it('sums only spendable, non archived accounts', () => {
    expect(spendableTotal(ACCOUNTS, balances)).toBe(603000);
  });

  it('sums every non archived account for net worth', () => {
    expect(netWorth(ACCOUNTS, balances)).toBe(-18240 + 603000 + 1050000);
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

describe('APRIL_CYCLE fixture', () => {
  it('is the design prototype cycle', () => {
    expect(APRIL_CYCLE).toEqual({ start: '2026-03-27', end: '2026-04-26' });
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

  it('takes the amount off the source and puts it on the destination', () => {
    const preview = transferBalancePreview(ACCOUNTS, aprilTransactions(), TODAY, draft);
    expect(preview.from).toEqual({ now: 603000, after: 553000 });
    expect(preview.to).toEqual({ now: 1050000, after: 1100000 });
  });

  it('has nothing to say about an account that is not chosen yet', () => {
    const preview = transferBalancePreview(ACCOUNTS, aprilTransactions(), TODAY, {
      ...draft,
      toAccountId: null,
    });
    // The pair is incomplete, so no money moves: the source still shows what it holds.
    expect(preview.from).toEqual({ now: 603000, after: 603000 });
    expect(preview.to).toBeNull();
  });

  it('moves nothing while the amount is still empty', () => {
    const preview = transferBalancePreview(ACCOUNTS, aprilTransactions(), TODAY, {
      ...draft,
      amount: 0,
    });
    expect(preview.from).toEqual({ now: 603000, after: 603000 });
    expect(preview.to).toEqual({ now: 1050000, after: 1050000 });
  });

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

  it('reports nothing for an account it does not know', () => {
    const preview = transferBalancePreview(ACCOUNTS, aprilTransactions(), TODAY, {
      ...draft,
      fromAccountId: 'acc-ghost',
    });
    expect(preview.from).toBeNull();
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

  it('catches a debit card going below zero, as it would a current account', () => {
    expect(transferOverdrawsSource({ type: 'debit_card' }, { now: 5000, after: -1000 })).toBe(true);
  });

  it('does not block a transfer that moves nothing yet', () => {
    // A future-dated transfer out of an account that is already in the red: `after === now`, so
    // this transfer is not what put it there.
    expect(transferOverdrawsSource(checking, { now: -5000, after: -5000 })).toBe(false);
  });

  it('has no opinion without a source account or a preview', () => {
    expect(transferOverdrawsSource(undefined, { now: 5000, after: -1000 })).toBe(false);
    expect(transferOverdrawsSource(checking, null)).toBe(false);
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

  it('has no statement without a close day, and no charge date without a charge day', () => {
    expect(creditStatementDue({ ...CARD, creditCloseDay: null }, [], TODAY)).toBeNull();
    expect(creditStatementDue({ ...CARD, creditChargeDay: null }, [], TODAY)?.chargeDate).toBeNull();
  });

  it('is only about credit cards', () => {
    expect(creditStatementDue({ ...CARD, type: 'checking' }, [], TODAY)).toBeNull();
  });

  it('closes today on the close day', () => {
    expect(creditStatementDue(CARD, [spend('2026-04-20', 1000)], '2026-04-20')).toMatchObject({
      closeDate: '2026-04-20',
      chargeDate: '2026-05-05',
      statement: 1000,
    });
  });
});

describe('paymentAccountCandidates', () => {
  it('offers live accounts that are not cards and not the card itself', () => {
    const list = [...ACCOUNTS, { ...CARD, id: 'acc-card-2' }];
    expect(paymentAccountCandidates(list, 'acc-card').map((account) => account.id)).toEqual([
      'acc-checking',
      'acc-savings',
    ]);
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

  it('falls back to the whole balance without a close day', () => {
    const txs = [spend('2026-04-01', 5000)];
    expect(
      creditSettlementDraft({ ...card, creditCloseDay: null }, ACCOUNTS, txs, TODAY),
    ).toMatchObject({ statementAmount: null, amount: 5000, date: TODAY, statementDate: TODAY });
  });

  it('leaves the source empty when the payment account is gone or archived', () => {
    const archived = { ...card, creditPaymentAccountId: 'acc-old' };
    expect(creditSettlementDraft(archived, ACCOUNTS, [], TODAY).fromAccountId).toBeNull();
    const none = { ...card, creditPaymentAccountId: null };
    expect(creditSettlementDraft(none, ACCOUNTS, [], TODAY).fromAccountId).toBeNull();
  });
});

describe('creditChargeReminders', () => {
  it('reminds on the charge day of a statement still due', () => {
    expect(creditChargeReminders(ACCOUNTS, [spend('2026-04-10', 30000)], '2026-04-25')).toEqual([
      { accountId: 'acc-card', date: '2026-05-05', amount: 30000 },
    ]);
  });

  it('includes the charge day itself', () => {
    expect(creditChargeReminders(ACCOUNTS, [spend('2026-04-10', 30000)], '2026-05-05')).toHaveLength(
      1,
    );
  });

  it('skips a paid statement and a charge day already past', () => {
    const paid = [spend('2026-04-10', 30000), pay('2026-05-05', 30000)];
    expect(creditChargeReminders(ACCOUNTS, paid, '2026-04-25')).toEqual([]);
    expect(creditChargeReminders(ACCOUNTS, [spend('2026-03-10', 30000)], TODAY)).toEqual([]);
  });

  it('skips a card with no charge day, and an archived card', () => {
    const txs = [spend('2026-04-10', 30000)];
    const noCharge = ACCOUNTS.map((account) =>
      account.id === 'acc-card' ? { ...account, creditChargeDay: null } : account,
    );
    expect(creditChargeReminders(noCharge, txs, '2026-04-25')).toEqual([]);
    const archived = ACCOUNTS.map((account) =>
      account.id === 'acc-card' ? { ...account, archivedAt: '2026-04-01T00:00:00.000Z' } : account,
    );
    expect(creditChargeReminders(archived, txs, '2026-04-25')).toEqual([]);
  });
});

describe('transferOverpaysCard', () => {
  const card = { type: 'credit_card' } as const;

  it('flags a transfer that takes a card into credit', () => {
    expect(transferOverpaysCard(card, { now: -5000, after: 1000 })).toBe(true);
  });

  it('lets a card be paid off exactly, or stay in debt', () => {
    expect(transferOverpaysCard(card, { now: -5000, after: 0 })).toBe(false);
    expect(transferOverpaysCard(card, { now: -5000, after: -1000 })).toBe(false);
  });

  it('is quiet when the transfer moves nothing, for other accounts, or without a preview', () => {
    expect(transferOverpaysCard(card, { now: 1000, after: 1000 })).toBe(false);
    expect(transferOverpaysCard({ type: 'checking' }, { now: -5000, after: 1000 })).toBe(false);
    expect(transferOverpaysCard(undefined, { now: -5000, after: 1000 })).toBe(false);
    expect(transferOverpaysCard(card, null)).toBe(false);
  });
});
