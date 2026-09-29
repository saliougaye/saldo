import { type Account, emptyUserData, type UserData } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { account } from '../test/fixtures';
import { accountDetail } from './detailView';

const TODAY = '2026-09-15';
const DEF = { kind: 'month', startDay: 1 } as const;

/** A plain checking account, `a1`, with whatever the test bends on top. */
function withAccount(over: Partial<Account> = {}): UserData {
  return { ...emptyUserData(), accounts: [account({ id: 'a1', name: 'Conto', ...over })] };
}

/** A pocket, `p1`, inside a parent account — a pocket the schema accepts needs one (§5.14). */
function withPocket(over: Partial<Account> = {}): UserData {
  return {
    ...emptyUserData(),
    accounts: [
      account({ id: 'a1', name: 'Conto' }),
      account({
        id: 'p1',
        name: 'Vacanza',
        type: 'pocket',
        parentAccountId: 'a1',
        includeInSpendable: false,
        ...over,
      }),
    ],
  };
}

describe('accountDetail', () => {
  it('is null for an id that is not there', () => {
    expect(accountDetail({ data: emptyUserData(), id: 'nope', today: TODAY, def: DEF })).toBeNull();
  });

  it('gives a plain account its balance, its eight month-ends and its period figures', () => {
    const view = accountDetail({
      data: withAccount({ openingBalance: 50000 }),
      id: 'a1',
      today: TODAY,
      def: DEF,
    });
    expect(view?.balance).toBe(50000);
    expect(view?.series).toHaveLength(8);
    expect(view?.statement).toBeNull();
  });

  it('gives a credit card its accrued statement and its next charge', () => {
    const view = accountDetail({
      data: withAccount({
        type: 'credit_card',
        creditCloseDay: 20,
        creditChargeDay: 5,
        openingBalance: -15000,
      }),
      id: 'a1',
      today: TODAY,
      def: DEF,
    });
    expect(view?.due).toBe(15000);
    expect(view?.statement).not.toBeNull();
  });

  it('gives a pocket its goal progress rather than a balance', () => {
    const view = accountDetail({
      data: withPocket({ goalTarget: 100000, openingBalance: 25000, goalStartDate: '2026-01-01' }),
      id: 'p1',
      today: TODAY,
      def: DEF,
    });
    expect(view?.goal?.saved).toBe(25000);
    expect(view?.goal?.ratio).toBeCloseTo(0.25, 2);
  });
});
