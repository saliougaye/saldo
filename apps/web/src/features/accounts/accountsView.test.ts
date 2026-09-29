import { emptyUserData } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { account } from '../test/fixtures';
import { accountsView } from './accountsView';

const TODAY = '2026-09-15';
const DEF = { kind: 'month', startDay: 1 } as const;

describe('accountsView', () => {
  it('splits savings and investments from everything else, by type', () => {
    const view = accountsView({
      data: {
        ...emptyUserData(),
        accounts: [
          account({ id: 'a1', name: 'Conto' }),
          account({ id: 'a2', name: 'Libretto', type: 'savings', includeInSpendable: false }),
          account({ id: 'a3', name: 'Contante', type: 'cash', includeInSpendable: false }),
        ],
      },
      today: TODAY,
      def: DEF,
    });
    expect(view.spending.map((row) => row.account.id)).toEqual(['a1', 'a3']);
    expect(view.savings.map((row) => row.account.id)).toEqual(['a2']);
  });

  it('nests a pocket under its account and never at the top level', () => {
    const view = accountsView({
      data: {
        ...emptyUserData(),
        accounts: [
          account({ id: 'a1', name: 'Conto' }),
          account({
            id: 'p1',
            name: 'Vacanza',
            type: 'pocket',
            parentAccountId: 'a1',
            includeInSpendable: false,
            goalTarget: 100000,
            goalStartDate: '2026-01-01',
          }),
        ],
      },
      today: TODAY,
      def: DEF,
    });
    expect(view.spending.map((row) => row.account.id)).toEqual(['a1']);
    expect(view.spending[0]?.pockets.map((pocket) => pocket.account.id)).toEqual(['p1']);
  });

  it('shows the account’s own money as «libero», beside the pockets’', () => {
    const view = accountsView({
      data: {
        ...emptyUserData(),
        accounts: [
          account({ id: 'a1', name: 'Conto', openingBalance: 100000 }),
          account({
            id: 'p1',
            name: 'Vacanza',
            type: 'pocket',
            parentAccountId: 'a1',
            includeInSpendable: false,
            openingBalance: 30000,
            goalTarget: 100000,
            goalStartDate: '2026-01-01',
          }),
        ],
      },
      today: TODAY,
      def: DEF,
    });
    expect(view.spending[0]?.balance).toBe(130000);
    expect(view.spending[0]?.free).toBe(100000);
    expect(view.spending[0]?.pockets[0]?.saved).toBe(30000);
  });

  it('keeps archived accounts out of both groups and out of the totals', () => {
    const view = accountsView({
      data: {
        ...emptyUserData(),
        accounts: [
          account({ id: 'a1', name: 'Conto', openingBalance: 5000 }),
          account({
            id: 'a2',
            name: 'Vecchio',
            openingBalance: 9000,
            archivedAt: '2026-01-01T00:00:00.000Z',
          }),
        ],
      },
      today: TODAY,
      def: DEF,
    });
    expect(view.archivedCount).toBe(1);
    expect(view.netWorth).toBe(5000);
    expect(view.spendable).toBe(5000);
  });

  it('is empty and not broken for an account with nothing', () => {
    const view = accountsView({ data: emptyUserData(), today: TODAY, def: DEF });
    expect(view.spending).toEqual([]);
    expect(view.netWorth).toBe(0);
  });
});
