import { describe, expect, it } from 'vitest';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { listAccountsTool } from './listAccounts';

describe('list_accounts', () => {
  it('gives today’s balances, the pockets under their account, and the two totals', () => {
    const result = listAccountsTool.run(fixtureData(), CONTEXT, { includeArchived: false });
    expect(result.netWorth.minor).toBe(1218050);
    expect(result.netWorth.amount).toBe('12180.50');
    expect(result.spendable.minor).toBe(668050);
    expect(result.accounts.map((account) => account.id)).toEqual(['a-main', 'a-save']);
    const main = result.accounts[0];
    expect(main?.balance.minor).toBe(718050);
    expect(main?.free.minor).toBe(668050);
    expect(main?.pockets).toEqual([
      {
        id: 'a-pocket',
        name: 'Vacanze',
        saved: { minor: 50000, currency: 'EUR', amount: '500.00' },
        target: { minor: 120000, currency: 'EUR', amount: '1200.00' },
        ratio: 50000 / 120000,
      },
    ]);
  });

  it('lists archived accounts only on request, marked', () => {
    const result = listAccountsTool.run(fixtureData(), CONTEXT, { includeArchived: true });
    const old = result.accounts.find((account) => account.id === 'a-old');
    expect(old?.archived).toBe(true);
    expect(old?.balance.minor).toBe(2000);
    // An archived account is never part of net worth.
    expect(result.netWorth.minor).toBe(1218050);
  });

  it('ignores rows dated after today', () => {
    const data = fixtureData();
    const before = listAccountsTool.run(data, CONTEXT, { includeArchived: false });
    const later = listAccountsTool.run(
      data,
      { ...CONTEXT, today: '2026-10-05' },
      {
        includeArchived: false,
      },
    );
    // Dinner (−15.00) on the 25th, salary (+2500.00) on 1 October, rent (−800.00) on the 5th.
    expect((later.accounts[0]?.free.minor ?? 0) - (before.accounts[0]?.free.minor ?? 0)).toBe(
      -1500 + 250000 - 80000,
    );
  });
});
