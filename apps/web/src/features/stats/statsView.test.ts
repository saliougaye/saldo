import {
  averageSeries,
  dailyCumulative,
  describePeriod,
  periodHistory,
  projectEndOfCycle,
} from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { CATEGORY, CATEGORY_2, dataWith, tx } from '../test/fixtures';
import { statsView } from './statsView';

const DEF = { kind: 'month', startDay: 1 } as const;
const TODAY = '2026-09-15';
const SEPTEMBER = describePeriod({ start: '2026-09-01', end: '2026-09-30' }, TODAY);
const JULY = describePeriod({ start: '2026-07-01', end: '2026-07-31' }, TODAY);

/** Three used periods before September, so the medians have something to read. */
const HISTORY = [
  tx({ id: 'jun', amount: 40000, date: '2026-06-05', categoryId: CATEGORY.id }),
  tx({ id: 'jul', amount: 70000, date: '2026-07-05', categoryId: CATEGORY_2.id }),
  tx({ id: 'aug', amount: 60000, date: '2026-08-05', categoryId: CATEGORY.id }),
];

describe('statsView', () => {
  it('gives the four key figures of a running period, projection included', () => {
    const txs = [
      ...HISTORY,
      tx({ id: 'a', amount: 200000, date: '2026-09-02', kind: 'income' }),
      tx({ id: 'b', amount: 60000, date: '2026-09-03' }),
      tx({ id: 'r', amount: 30000, date: '2026-09-04', recurrenceId: 'r1' }),
      tx({ id: 'later', amount: 5000, date: '2026-09-20' }),
    ];
    const view = statsView({
      data: dataWith(txs),
      def: DEF,
      today: TODAY,
      period: SEPTEMBER,
      direction: 'expense',
    });
    expect(view.figures.kind).toBe('current');
    expect(view.figures.income).toBe(200000);
    expect(view.figures.spent).toBe(90000);
    expect(view.figures.net).toBe(110000);
    expect(view.figures.projection).toBe(
      projectEndOfCycle({
        spent: 90000,
        committed: 30000,
        elapsed: 15,
        length: 30,
        upcoming: 5000,
      }),
    );
    // The median of Jun, Jul and Aug: what the projection is read against.
    expect(view.figures.median).toBe(60000);
  });

  it('offers no projection without a median, as the phone', () => {
    const view = statsView({
      data: dataWith([tx({ id: 'b', amount: 600, date: '2026-09-03' })]),
      def: DEF,
      today: TODAY,
      period: SEPTEMBER,
      direction: 'expense',
    });
    expect(view.figures.median).toBeNull();
    expect(view.figures.projection).toBeNull();
  });

  it('offers no projection with fewer than three days left', () => {
    const view = statsView({
      data: dataWith(HISTORY),
      def: DEF,
      today: '2026-09-28',
      period: describePeriod(SEPTEMBER.range, '2026-09-28'),
      direction: 'expense',
    });
    expect(view.figures.projection).toBeNull();
  });

  it('replaces the projection with the committed share on a closed period', () => {
    const view = statsView({
      data: dataWith([
        tx({ id: 'b', amount: 900, date: '2026-07-03' }),
        tx({ id: 'r', amount: 300, date: '2026-07-04', recurrenceId: 'r1' }),
      ]),
      def: DEF,
      today: TODAY,
      period: JULY,
      direction: 'expense',
    });
    expect(view.figures.kind).toBe('closed');
    expect(view.figures.projection).toBeNull();
    expect(view.committed).toEqual({ amount: 300, discretionary: 900, share: 25 });
  });

  it('reads each delta against the median of the periods the category was spent in', () => {
    // July was used, but not for c1: the phone drops that zero before the median, so the
    // baseline is (60000 + 40000) / 2, not the 40000 a zero would drag it to.
    const view = statsView({
      data: dataWith([...HISTORY, tx({ id: 'a', amount: 30000, date: '2026-09-02' })]),
      def: DEF,
      today: TODAY,
      period: SEPTEMBER,
      direction: 'expense',
    });
    expect(view.split.rows[0]?.delta).toBe(-40);
  });

  it('gives the two series of the trend, «il solito» over three periods and not six', () => {
    const txs = [
      tx({ id: 'apr', amount: 900000, date: '2026-04-02' }),
      tx({ id: 'aug', amount: 3000, date: '2026-08-02' }),
      tx({ id: 'a', amount: 300, date: '2026-09-02' }),
    ];
    const view = statsView({
      data: dataWith(txs),
      def: DEF,
      today: TODAY,
      period: SEPTEMBER,
      direction: 'expense',
    });
    expect(view.trend.current).toEqual(dailyCumulative(txs, SEPTEMBER.range, TODAY));
    expect(view.trend.usual).toHaveLength(view.trend.current.length);
    expect(view.trend.usual).toEqual(
      averageSeries(
        periodHistory(txs, DEF, SEPTEMBER.range, 3).map((entry) =>
          dailyCumulative(entry.txs, entry.period, TODAY),
        ),
        view.trend.current.length,
      ),
    );
    // April is five periods back: inside the medians' window, outside «il solito».
    expect(view.trend.usual.at(-1)).toBe(3000);
  });
});
