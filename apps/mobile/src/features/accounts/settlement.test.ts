import type { CreditSettlementDraft } from '@saldo/core';
import { settlementForm, settlementParams } from './settlement';

const draft: CreditSettlementDraft = {
  fromAccountId: 'acc-checking',
  toAccountId: 'acc-card',
  statementAmount: 30000,
  balanceAmount: 35000,
  amount: 30000,
  date: '2026-05-05',
  statementDate: '2026-04-20',
};
const TODAY = '2026-04-25';

describe('settlement params', () => {
  it('round-trips a draft through route params into a transfer form', () => {
    const form = settlementForm(settlementParams(draft, 'Saldo Visa · aprile 2026'), TODAY, 2);
    expect(form?.values).toMatchObject({
      kind: 'transfer',
      buffer: '300',
      date: '2026-05-05',
      accountId: 'acc-checking',
      toAccountId: 'acc-card',
      categoryId: null,
      description: 'Saldo Visa · aprile 2026',
      recurrence: null,
    });
    expect(form?.shortcuts).toEqual([
      { key: 'statement', minor: 30000 },
      { key: 'balance', minor: 35000 },
    ]);
  });

  it('offers no shortcuts when statement and balance agree, or there is no statement', () => {
    const same = settlementParams({ ...draft, balanceAmount: 30000 }, '');
    expect(settlementForm(same, TODAY, 2)?.shortcuts).toEqual([]);
    const none = settlementParams({ ...draft, statementAmount: null }, '');
    expect(settlementForm(none, TODAY, 2)?.shortcuts).toEqual([]);
    const paid = settlementParams({ ...draft, statementAmount: 0 }, '');
    expect(settlementForm(paid, TODAY, 2)?.shortcuts).toEqual([]);
  });

  it('leaves the source empty and the amount blank when there is nothing to take', () => {
    const params = settlementParams({ ...draft, fromAccountId: null, amount: 0 }, '');
    expect(settlementForm(params, TODAY, 2)?.values).toMatchObject({ accountId: null, buffer: '' });
  });

  it('ignores a plain new transaction, and reads a malformed link safely', () => {
    expect(settlementForm({}, TODAY, 2)).toBeNull();
    expect(
      settlementForm({ settleTo: 'acc-card', date: 'nope', amount: 'x' }, TODAY, 2)?.values,
    ).toMatchObject({ date: TODAY, buffer: '', accountId: null });
  });
});
