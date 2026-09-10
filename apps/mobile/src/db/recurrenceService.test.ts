import type { PeriodDef, Transaction } from '@saldo/core';
import {
  applyRecurrenceEdit,
  type RecurrenceEditValues,
  runMaterialiser,
  startRecurrence,
} from './recurrenceService';
import { createRepositories } from './repositories';
import { createTestDatabase } from './testing';

/** These tests were written against a pay cycle (§5.2), still one kind among four. */
const CYCLE_DEF: PeriodDef = { kind: 'cycle', startDay: 27 };

const TODAY = '2026-04-18';

const TEMPLATE = {
  kind: 'expense',
  amount: 78000,
  accountId: 'acc-checking',
  toAccountId: null,
  categoryId: 'cat-rent',
  description: 'Affitto',
  tagIds: [],
  excludeFromTotals: false,
} satisfies RecurrenceEditValues;

function setup() {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => '2026-04-18T09:00:00.000Z');
  return { db, repos };
}

function dates(repos: ReturnType<typeof createRepositories>): string[] {
  return repos.transactions
    .list()
    .map((tx) => tx.date)
    .sort();
}

describe('runMaterialiser', () => {
  it('creates occurrences up to the end of the cycle after the current one', () => {
    const { db, repos } = setup();
    repos.recurrences.create({
      id: 'rec-rent',
      frequency: 'monthly',
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    const created = runMaterialiser(db, repos, TODAY, CYCLE_DEF);
    // Horizon is 2026-05-26, so Feb, Mar and Apr fire.
    expect(created).toBe(3);
    expect(dates(repos)).toEqual(['2026-02-27', '2026-03-27', '2026-04-27']);
  });

  it('is idempotent', () => {
    const { db, repos } = setup();
    repos.recurrences.create({
      id: 'rec-rent',
      frequency: 'monthly',
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    runMaterialiser(db, repos, TODAY, CYCLE_DEF);
    expect(runMaterialiser(db, repos, TODAY, CYCLE_DEF)).toBe(0);
  });

  it('does not resurrect a deleted occurrence', () => {
    const { db, repos } = setup();
    repos.recurrences.create({
      id: 'rec-rent',
      frequency: 'monthly',
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    runMaterialiser(db, repos, TODAY, CYCLE_DEF);
    repos.transactions.remove('rec-rent:2026-03-27');
    expect(runMaterialiser(db, repos, TODAY, CYCLE_DEF)).toBe(0);
    expect(dates(repos)).toEqual(['2026-02-27', '2026-04-27']);
  });

  it('ignores a tombstoned recurrence', () => {
    const { db, repos } = setup();
    const recurrence = repos.recurrences.create({
      frequency: 'monthly',
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    repos.recurrences.remove(recurrence.id);
    expect(runMaterialiser(db, repos, TODAY, CYCLE_DEF)).toBe(0);
  });
});

describe('startRecurrence', () => {
  it('replaces the saved transaction with the deterministic first occurrence', () => {
    const { db, repos } = setup();
    const saved = repos.transactions.create({
      kind: 'expense',
      amount: 1299,
      date: '2026-04-10',
      accountId: 'acc-card',
      toAccountId: null,
      categoryId: 'cat-subscriptions',
      description: 'Netflix',
      note: null,
      tagIds: [],
      excludeFromTotals: false,
      recurrenceId: null,
    });
    const recurrence = startRecurrence(db, repos, saved, TODAY, CYCLE_DEF);
    const live = repos.transactions.list();
    expect(live.map((tx) => tx.id)).toContain(`${recurrence.id}:2026-04-10`);
    expect(repos.transactions.byId(saved.id)?.deletedAt).not.toBeNull();
    // Horizon 2026-05-26, so the May occurrence is scheduled too.
    expect(dates(repos)).toEqual(['2026-04-10', '2026-05-10']);
  });
});

describe('applyRecurrenceEdit', () => {
  function seeded() {
    const { db, repos } = setup();
    repos.recurrences.create({
      id: 'rec-rent',
      frequency: 'monthly',
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    runMaterialiser(db, repos, TODAY, CYCLE_DEF);
    const recurrence = repos.recurrences.byId('rec-rent');
    if (recurrence === null) throw new Error('missing recurrence');
    return { db, repos, recurrence };
  }

  const edited: RecurrenceEditValues = { ...TEMPLATE, amount: 80000 };

  function occurrence(repos: ReturnType<typeof createRepositories>, date: string): Transaction {
    const found = repos.transactions.list().find((tx) => tx.date === date);
    if (found === undefined) throw new Error(`no occurrence on ${date}`);
    return found;
  }

  it('"only this" changes one row and leaves the template alone', () => {
    const { db, repos, recurrence } = seeded();
    applyRecurrenceEdit(db, repos, 'only-this', {
      recurrence,
      occurrence: occurrence(repos, '2026-03-27'),
      values: edited,
      date: '2026-03-27',
      today: TODAY,
      def: CYCLE_DEF,
    });
    expect(occurrence(repos, '2026-03-27').amount).toBe(80000);
    expect(occurrence(repos, '2026-02-27').amount).toBe(78000);
    expect(repos.recurrences.byId('rec-rent')?.template.amount).toBe(78000);
  });

  it('"all" rewrites the template and every occurrence, keeping their dates', () => {
    const { db, repos, recurrence } = seeded();
    applyRecurrenceEdit(db, repos, 'all', {
      recurrence,
      occurrence: occurrence(repos, '2026-03-27'),
      values: edited,
      date: '2026-03-27',
      today: TODAY,
      def: CYCLE_DEF,
    });
    expect(repos.transactions.list().every((tx) => tx.amount === 80000)).toBe(true);
    expect(dates(repos)).toEqual(['2026-02-27', '2026-03-27', '2026-04-27']);
    expect(repos.recurrences.byId('rec-rent')?.template.amount).toBe(80000);
  });

  it('"this and following" closes the old series and starts a new one', () => {
    const { db, repos, recurrence } = seeded();
    applyRecurrenceEdit(db, repos, 'this-and-following', {
      recurrence,
      occurrence: occurrence(repos, '2026-04-27'),
      values: edited,
      date: '2026-04-27',
      today: TODAY,
      def: CYCLE_DEF,
    });
    expect(repos.recurrences.byId('rec-rent')?.endDate).toBe('2026-04-26');
    const series = repos.recurrences.list();
    expect(series).toHaveLength(2);
    // Past occurrences keep the old amount; the new series carries the edited one.
    expect(occurrence(repos, '2026-02-27').amount).toBe(78000);
    expect(occurrence(repos, '2026-03-27').amount).toBe(78000);
    expect(occurrence(repos, '2026-04-27').amount).toBe(80000);
    // The horizon ends on 2026-05-26 (§5.9), so an occurrence on the 27th of the next month is
    // always just out of reach; the run after 27 Apr picks it up.
    expect(dates(repos)).toEqual(['2026-02-27', '2026-03-27', '2026-04-27']);
  });
});
