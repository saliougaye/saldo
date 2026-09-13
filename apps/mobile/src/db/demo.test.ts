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
import { runMaterialiser } from './recurrenceService';
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

  // The Profile row is an ordinary list row and a second tap used to duplicate the whole category
  // catalogue, which is what made the admin list show three "Spesa" with the transactions on the
  // first one only.
  it('does nothing on a second run', () => {
    const db = createTestDatabase();
    const repos = createRepositories(db, () => '2026-09-10T09:00:00.000Z');
    const load = () =>
      seedDemoData(repos, { today: TODAY, def: CYCLE_DEF, translate: (key) => key });
    load();
    const categories = repos.categories.list().length;
    load();
    load();
    expect(repos.categories.list()).toHaveLength(categories);
    expect(repos.accounts.list()).toHaveLength(DEMO_ACCOUNTS.length);
    expect(repos.transactions.list()).toHaveLength(DEMO_TRANSACTIONS.length);
  });

  it('reuses the categories onboarding already wrote instead of adding a second set', () => {
    const db = createTestDatabase();
    const repos = createRepositories(db, () => '2026-09-10T09:00:00.000Z');
    const existing = repos.categories.create({
      name: 'groceries',
      direction: 'expense',
      parentId: null,
      icon: 'cart',
      colorIndex: 0,
      archivedAt: null,
      sortOrder: 0,
    });
    seedDemoData(repos, { today: TODAY, def: CYCLE_DEF, translate: (key) => key });
    const groceries = repos.categories
      .list()
      .filter((row) => row.name === 'groceries' && row.parentId === null);
    expect(groceries).toHaveLength(1);
    expect(groceries[0]?.id).toBe(existing.id);
  });

  it('shifts with the cycle, whatever today is', () => {
    for (const today of ['2026-01-05', '2026-09-10', '2027-02-28'] as const) {
      const repos = seed(today);
      const cycle = periodContaining(CYCLE_DEF, today);
      const inCycle = repos.transactions.list().filter((tx) => isWithin(cycle, tx.date));
      expect(inCycle.length).toBeGreaterThan(20);
    }
  });

  // A transaction's `recurrenceId` used to be a synthetic `demo-recurrence:<description>` string
  // with no backing row: EditTransaction would open RecurrenceScopeSheet, which looks the id up,
  // finds nothing, returns null, and the sheet silently fails to appear. Every recurring
  // transaction must point at a real `recurrences` row.
  it('never points a transaction at a recurrence that does not exist', () => {
    const repos = seed();
    const recurrenceIds = new Set(repos.recurrences.list().map((recurrence) => recurrence.id));
    const recurring = repos.transactions.list().filter((tx) => tx.recurrenceId !== null);
    expect(recurring.length).toBeGreaterThan(0);
    for (const tx of recurring) {
      expect(recurrenceIds.has(tx.recurrenceId as string)).toBe(true);
    }
  });

  // The seeded recurrences are windowed to their own anchor date (`startDate === endDate`)
  // precisely so this holds: the app runs the materialiser right after seeding (DevTools) and on
  // every open (MaterialiserGate), and it must not invent extra transactions on top of the
  // curated fixture.
  it('leaves the materialiser with nothing to generate', () => {
    const db = createTestDatabase();
    const repos = createRepositories(db, () => '2026-09-10T09:00:00.000Z');
    seedDemoData(repos, { today: TODAY, def: CYCLE_DEF, translate: (key) => key });
    const before = repos.transactions.list().length;
    const created = runMaterialiser(db, repos, TODAY, CYCLE_DEF);
    expect(created).toBe(0);
    expect(repos.transactions.list()).toHaveLength(before);
  });
});
