import { describe, expect, it } from 'vitest';
import { ACCOUNTS, APRIL_CYCLE, aprilTransactions, TODAY, tx } from './__tests__/fixtures';
import {
  accountBalances,
  creditCardDue,
  creditStatementAccrued,
  netWorth,
  nextCreditChargeDate,
  spendableTotal,
  transferBalancePreview,
  transferOverdrawsSource,
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
