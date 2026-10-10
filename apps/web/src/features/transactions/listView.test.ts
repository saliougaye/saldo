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
});
