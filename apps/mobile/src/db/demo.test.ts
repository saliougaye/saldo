import type { PeriodDef } from '@saldo/core';
import {
  accountBalances,
  isWithin,
  periodContaining,
  spendingByCategory,
  summarizePeriod,
} from '@saldo/core';
import { seedDemoData } from './demo';
import { DEMO_ACCOUNTS, DEMO_TRANSACTIONS } from './demoData.generated';
import { createRepositories } from './repositories';
import { createTestDatabase } from './testing';

/** These tests were written against a pay cycle (§5.2), still one kind among four. */
const CYCLE_DEF: PeriodDef = { kind: 'cycle', startDay: 27 };

const TODAY = '2026-09-10';

function seed(today = TODAY) {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => '2026-09-10T09:00:00.000Z');
  seedDemoData(repos, {
    today,
    def: CYCLE_DEF,
    translate: (key) => key,
  });
  return repos;
}

describe('seedDemoData', () => {
  it('creates the prototype accounts, categories, tags and budgets', () => {
    const repos = seed();
    expect(repos.accounts.list()).toHaveLength(DEMO_ACCOUNTS.length);
    expect(repos.transactions.list()).toHaveLength(DEMO_TRANSACTIONS.length);
    expect(
      repos.tags
        .list()
        .map((tag) => tag.name)
        .sort(),
    ).toEqual(['Regalo', 'Rimborsabile', 'Trasloco', 'Vacanza Grecia']);
    expect(repos.budgets.list()).toHaveLength(5);
  });

  it('shifts the data so the current cycle holds transactions on both sides of today', () => {
    const repos = seed();
    const cycle = periodContaining(CYCLE_DEF, TODAY);
    const inCycle = repos.transactions.list().filter((tx) => isWithin(cycle, tx.date));
    expect(inCycle.length).toBeGreaterThan(20);
    expect(inCycle.some((tx) => tx.date < TODAY)).toBe(true);
    expect(inCycle.some((tx) => tx.date > TODAY)).toBe(true);
  });

  it('gives every account the balance the prototype shows', () => {
    const repos = seed();
    const accounts = repos.accounts.list();
    const balances = accountBalances(accounts, repos.transactions.list(), '2099-12-31');
    for (const account of DEMO_ACCOUNTS) {
      const created = accounts.find((candidate) => candidate.name === account.name);
      expect(created).toBeDefined();
      expect(balances.get(created?.id ?? '')).toBe(account.balance);
    }
  });

  it('produces a cycle with income, spending and a committed share', () => {
    const repos = seed();
    const cycle = periodContaining(CYCLE_DEF, TODAY);
    const summary = summarizePeriod(repos.transactions.list(), cycle, TODAY);
    expect(summary.income).toBeGreaterThan(0);
    expect(summary.spent).toBeGreaterThan(0);
    expect(summary.remaining).toBe(summary.income - summary.spent);
    const committed = repos.transactions
      .list()
      .filter((tx) => tx.recurrenceId !== null && isWithin(cycle, tx.date));
    expect(committed.length).toBeGreaterThan(0);
  });

  it('spreads spending over several categories, so the split bar is not one segment', () => {
    const repos = seed();
    const cycle = periodContaining(CYCLE_DEF, TODAY);
    const spending = spendingByCategory(repos.transactions.list(), cycle, TODAY);
    expect(spending.size).toBeGreaterThan(4);
  });

  it('keeps the excluded transactions excluded', () => {
    const repos = seed();
    const excluded = repos.transactions.list().filter((tx) => tx.excludeFromTotals);
    expect(excluded).toHaveLength(DEMO_TRANSACTIONS.filter((tx) => tx.excluded).length);
  });

  it('shifts with the cycle, whatever today is', () => {
    for (const today of ['2026-01-05', '2026-09-10', '2027-02-28'] as const) {
      const repos = seed(today);
      const cycle = periodContaining(CYCLE_DEF, today);
      const inCycle = repos.transactions.list().filter((tx) => isWithin(cycle, tx.date));
      expect(inCycle.length).toBeGreaterThan(20);
    }
  });
});
