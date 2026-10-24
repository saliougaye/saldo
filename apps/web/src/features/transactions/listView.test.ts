import { EMPTY_FILTERS } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { dataWith, tx } from '../test/fixtures';
import { listView } from './listView';

describe('listView', () => {
  // The same leak Task 9 fixed on Home. Without the upper bound, a closed August would list a row
  // dated in September — settled, so nothing else hides it.
  it('keeps a closed period’s list inside it, as the phone’s query does', () => {
    const view = listView({
      data: dataWith([
        tx({ id: 'inside', amount: 100, date: '2026-08-20' }),
        tx({ id: 'after', amount: 100, date: '2026-09-10' }),
      ]),
      filters: EMPTY_FILTERS,
      today: '2026-09-15',
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

  // Bug: «In arrivo» reached the end of the *next* period, so on a current September it listed the
  // October rent. It holds only what is dated after today inside the current period.
  it('keeps «In arrivo» inside the current period', () => {
    const view = listView({
      data: dataWith([
        tx({ id: 'later-this-month', amount: 100, date: '2026-09-28' }),
        tx({ id: 'next-month', amount: 100, date: '2026-10-05' }),
      ]),
      filters: EMPTY_FILTERS,
      today: '2026-09-15',
      period: {
        range: { start: '2026-09-01', end: '2026-09-30' },
        isCurrent: true,
        elapsed: 15,
        length: 30,
      },
    });
    expect(view.upcomingDays.flatMap((day) => day.rows).map((row) => row.id)).toEqual([
      'later-this-month',
    ]);
  });

  // Bug: the row said «Spesa» only, though figure 3 and the mockup say «Groceries · Card». The
  // account follows the category, and goes when the list is already filtered to that account.
  it('names the account after the category, except in a list filtered to that account', () => {
    const input = {
      data: dataWith([
        tx({ id: 'checking', amount: 100, date: '2026-09-10' }),
        tx({ id: 'savings', amount: 100, date: '2026-09-10', accountId: 'a2' }),
      ]),
      today: '2026-09-15',
      period: {
        range: { start: '2026-09-01', end: '2026-09-30' },
        isCurrent: true,
        elapsed: 15,
        length: 30,
      },
    };
    const subtitles = (view: ReturnType<typeof listView>) =>
      view.days.flatMap((day) => day.rows).map((row) => [row.id, row.subtitle]);

    expect(subtitles(listView({ ...input, filters: EMPTY_FILTERS }))).toEqual([
      ['savings', 'Spesa · Risparmi'],
      ['checking', 'Spesa · Conto'],
    ]);
    expect(
      subtitles(listView({ ...input, filters: { ...EMPTY_FILTERS, accountId: 'a2' } })),
    ).toEqual([['savings', 'Spesa']]);
  });
});
