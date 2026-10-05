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
      def: { kind: 'month', startDay: 1 },
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
});
