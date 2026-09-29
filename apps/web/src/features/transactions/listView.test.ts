import { accountSchema, EMPTY_FILTERS, emptyUserData, tagSchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT,
  ACCOUNT_2,
  CATEGORY,
  CATEGORY_2,
  CATEGORY_CHILD,
  dataWith,
  TAG,
  tx,
} from '../test/fixtures';
import { filterChoices, listView } from './listView';

const TODAY = '2026-09-15';
const PERIOD = {
  range: { start: '2026-09-01', end: '2026-09-30' },
  isCurrent: true,
  elapsed: 15,
  length: 30,
};
const DEF = { kind: 'month', startDay: 1 } as const;

describe('listView', () => {
  it('groups by day, newest day first, with the day’s expense total', () => {
    const view = listView({
      data: dataWith([
        tx({ id: 'a', amount: 300, date: '2026-09-10' }),
        tx({ id: 'b', amount: 700, date: '2026-09-10' }),
        tx({ id: 'c', amount: 100, date: '2026-09-12' }),
      ]),
      filters: EMPTY_FILTERS,
      today: TODAY,
      def: DEF,
      period: PERIOD,
    });
    expect(view.days.map((day) => day.date)).toEqual(['2026-09-12', '2026-09-10']);
    expect(view.days[1]?.expenseTotal).toBe(1000);
  });

  it('keeps income and transfers out of a day’s total, as the phone does', () => {
    const view = listView({
      data: dataWith([
        tx({ id: 'a', amount: 300, date: '2026-09-10' }),
        tx({ id: 'b', amount: 900, date: '2026-09-10', kind: 'income' }),
      ]),
      filters: EMPTY_FILTERS,
      today: TODAY,
      def: DEF,
      period: PERIOD,
    });
    expect(view.days[0]?.expenseTotal).toBe(300);
    expect(view.days[0]?.rows).toHaveLength(2);
  });

  it('splits what is dated ahead into «In arrivo», with its net', () => {
    const view = listView({
      data: dataWith([
        tx({ id: 'past', amount: 300, date: '2026-09-10' }),
        tx({ id: 'ahead', amount: 500, date: '2026-09-20' }),
      ]),
      filters: EMPTY_FILTERS,
      today: TODAY,
      def: DEF,
      period: PERIOD,
    });
    expect(view.upcoming.count).toBe(1);
    expect(view.upcoming.net).toBe(-500);
    expect(view.days.flatMap((day) => day.rows).map((row) => row.id)).toEqual(['past']);
  });

  it('applies the filters through core, and says the filtered totals', () => {
    const view = listView({
      data: dataWith([
        tx({ id: 'a', amount: 300, date: '2026-09-10', description: 'Bar' }),
        tx({ id: 'b', amount: 900, date: '2026-09-11', description: 'Benzina' }),
      ]),
      filters: { ...EMPTY_FILTERS, query: 'bar' },
      today: TODAY,
      def: DEF,
      period: PERIOD,
    });
    expect(view.days.flatMap((day) => day.rows).map((row) => row.id)).toEqual(['a']);
    expect(view.totals.expense).toBe(300);
    expect(view.filtered).toBe(true);
  });

  // Not one of the plan's cases: the same leak Task 9 fixed on Home. Without the upper bound,
  // a closed August would list a row dated in September — settled, so nothing else hides it.
  it('keeps a closed period\u2019s list inside it, as the phone\u2019s query does', () => {
    const view = listView({
      data: dataWith([
        tx({ id: 'inside', amount: 100, date: '2026-08-20' }),
        tx({ id: 'after', amount: 100, date: '2026-09-10' }),
      ]),
      filters: EMPTY_FILTERS,
      today: TODAY,
      def: DEF,
      period: {
        range: { start: '2026-08-01', end: '2026-08-31' },
        isCurrent: false,
        elapsed: 31,
        length: 31,
      },
    });
    expect(view.days.flatMap((day) => day.rows).map((row) => row.id)).toEqual(['inside']);
    expect(view.upcoming.count).toBe(0);
  });

  it('is empty, not broken, for an account with nothing', () => {
    const view = listView({
      data: emptyUserData(),
      filters: EMPTY_FILTERS,
      today: TODAY,
      def: DEF,
      period: PERIOD,
    });
    expect(view.days).toEqual([]);
    expect(view.upcoming.count).toBe(0);
    expect(view.filtered).toBe(false);
  });

  it('counts the transfers a direction chip hides, and nothing for «all» or «transfers»', () => {
    const data = dataWith([
      tx({ id: 'e', amount: 300, date: '2026-09-10' }),
      tx({
        id: 't',
        amount: 500,
        date: '2026-09-11',
        kind: 'transfer',
        toAccountId: ACCOUNT_2.id,
        categoryId: null,
      }),
    ]);
    const base = { data, today: TODAY, def: DEF, period: PERIOD };
    expect(
      listView({ ...base, filters: { ...EMPTY_FILTERS, direction: 'expense' } }).hiddenTransfers,
    ).toBe(1);
    expect(listView({ ...base, filters: EMPTY_FILTERS }).hiddenTransfers).toBe(0);
    expect(
      listView({ ...base, filters: { ...EMPTY_FILTERS, direction: 'transfer' } }).hiddenTransfers,
    ).toBe(0);
  });

  it('subtitles a row with its tags while a tag filter is on, as the phone does', () => {
    const other = tagSchema.parse({ ...TAG, id: 'g0', name: 'Amici' });
    const data = dataWith(
      [tx({ id: 'a', amount: 300, date: '2026-09-10', tagIds: [TAG.id, 'g0'] })],
      {
        tags: [TAG, other],
      },
    );
    const base = { data, today: TODAY, def: DEF, period: PERIOD };
    const tagged = listView({ ...base, filters: { ...EMPTY_FILTERS, tagIds: [TAG.id] } });
    expect(tagged.days[0]?.rows[0]?.subtitle).toBe('Amici · Vacanza');
    const plain = listView({ ...base, filters: EMPTY_FILTERS });
    expect(plain.days[0]?.rows[0]?.subtitle).toBe('Spesa');
  });
});

describe('filterChoices', () => {
  it('orders the accounts as the phone’s sheet does, and marks the archived ones', () => {
    const archived = accountSchema.parse({
      ...ACCOUNT,
      id: 'a3',
      name: 'Banca',
      sortOrder: 0,
      archivedAt: '2026-05-01T00:00:00.000Z',
    });
    const data = dataWith([], { accounts: [ACCOUNT_2, ACCOUNT, archived] });
    expect(filterChoices(data).accounts).toEqual([
      { id: 'a3', name: 'Banca', archived: true },
      { id: 'a1', name: 'Conto', archived: false },
      { id: 'a2', name: 'Risparmi', archived: false },
    ]);
  });

  it('orders the tags by how often they are used, then by name', () => {
    const amici = tagSchema.parse({ ...TAG, id: 'g0', name: 'Amici' });
    const zeta = tagSchema.parse({ ...TAG, id: 'g2', name: 'Zeta' });
    const data = dataWith(
      [
        tx({ id: 'a', amount: 1, date: '2026-09-10', tagIds: ['g2'] }),
        tx({ id: 'b', amount: 1, date: '2026-09-10', tagIds: ['g2', 'g1'] }),
      ],
      { tags: [zeta, TAG, amici] },
    );
    expect(filterChoices(data).tags.map((tag) => tag.name)).toEqual(['Zeta', 'Vacanza', 'Amici']);
  });

  it('lists the categories in display order, each parent followed by its children', () => {
    const data = dataWith([], { categories: [CATEGORY_2, CATEGORY_CHILD, CATEGORY] });
    expect(filterChoices(data).categories).toEqual([
      { id: CATEGORY.id, name: 'Spesa', child: false },
      { id: CATEGORY_CHILD.id, name: 'Frutta', child: true },
      { id: CATEGORY_2.id, name: 'Casa', child: false },
    ]);
  });
});
