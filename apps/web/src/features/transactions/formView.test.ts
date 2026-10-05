import { accountBalances } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { ACCOUNT, ACCOUNT_2, account, dataWith, tx } from '../test/fixtures';
import { formView } from './formView';

const TODAY = '2026-09-20';

const POCKET = account({
  id: 'p1',
  name: 'Vacanze',
  type: 'pocket',
  includeInSpendable: false,
  parentAccountId: ACCOUNT.id,
  goalTarget: 100000,
  goalStartDate: '2026-01-01',
  sortOrder: 2,
});

const ARCHIVED = account({
  id: 'a3',
  name: 'Vecchio',
  archivedAt: '2026-05-01T00:00:00.000Z',
  sortOrder: 3,
});

describe('formView', () => {
  it('lists the accounts in the chips’ order, pockets flagged, balances without the edited row', () => {
    const edited = tx({ id: 't1', amount: 500, date: '2026-09-10' });
    const other = tx({ id: 't2', amount: 200, date: '2026-09-11' });
    const data = dataWith([edited, other], { accounts: [ACCOUNT, ACCOUNT_2, POCKET, ARCHIVED] });
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'edit', id: 't1' });
    const balances = accountBalances(data.accounts, [other], TODAY);
    expect(view?.accounts.map((a) => [a.id, a.pocket, a.archived, a.balance])).toEqual([
      [ACCOUNT.id, false, false, balances.get(ACCOUNT.id)],
      [POCKET.id, true, false, balances.get(POCKET.id)],
      [ACCOUNT_2.id, false, false, balances.get(ACCOUNT_2.id)],
    ]);
    expect(view?.accounts[0]?.balance).toBe(-200);
  });

  it('carries the balance with the edited row too, the `now` of the transfer preview', () => {
    const edited = tx({ id: 't1', amount: 500, date: '2026-09-10' });
    const other = tx({ id: 't2', amount: 200, date: '2026-09-11' });
    const data = dataWith([edited, other], { accounts: [ACCOUNT] });
    const view = formView({ data, today: TODAY, currency: 'EUR', mode: 'edit', id: 't1' });
    expect(view?.accounts[0]?.balanceNow).toBe(-700);
    expect(view?.accounts[0]?.balance).toBe(-200);
    const fresh = formView({ data, today: TODAY, currency: 'EUR', mode: 'new', id: null });
    expect(fresh?.accounts[0]?.balanceNow).toBe(-700);
    expect(fresh?.accounts[0]?.balance).toBe(-700);
  });
});
