import { describe, expect, it } from 'vitest';
import { dataWith, tx } from '../test/fixtures';
import { homeView } from './homeView';

describe('homeView', () => {
  it('keeps «Ultime transazioni» inside a closed period, as the phone’s query does', () => {
    const view = homeView({
      data: dataWith([
        tx({ id: 'inside', amount: 100, date: '2026-08-20' }),
        tx({ id: 'after', amount: 100, date: '2026-09-10' }),
      ]),
      today: '2026-09-15',
      def: { kind: 'month', startDay: 1 },
      period: {
        range: { start: '2026-08-01', end: '2026-08-31' },
        isCurrent: false,
        elapsed: 31,
        length: 31,
      },
    });
    expect(view.recent.map((row) => row.id)).toEqual(['inside']);
  });

  it('nets «In arrivo»: income minus expense, not the two added as positives', () => {
    const view = homeView({
      data: dataWith([
        tx({ id: 'rent', amount: 1000, date: '2026-09-20' }),
        tx({ id: 'pay', amount: 300, kind: 'income', date: '2026-09-25' }),
      ]),
      today: '2026-09-15',
      def: { kind: 'month', startDay: 1 },
      period: {
        range: { start: '2026-09-01', end: '2026-09-30' },
        isCurrent: true,
        elapsed: 15,
        length: 30,
      },
    });
    expect(view.upcoming.net).toBe(-700);
  });

  it('lists «Coming up» with the nearest date first (H7)', () => {
    const view = homeView({
      data: dataWith([
        tx({ id: 'far', amount: 100, date: '2026-09-28' }),
        tx({ id: 'near', amount: 100, date: '2026-09-17' }),
        tx({ id: 'middle', amount: 100, date: '2026-09-22' }),
      ]),
      today: '2026-09-15',
      def: { kind: 'month', startDay: 1 },
      period: {
        range: { start: '2026-09-01', end: '2026-09-30' },
        isCurrent: true,
        elapsed: 15,
        length: 30,
      },
    });
    expect(view.upcoming.rows.map((row) => row.id)).toEqual(['near', 'middle', 'far']);
  });

  it('shows 10 latest rows in a closed period and 5 in the current one (H8)', () => {
    const august = Array.from({ length: 12 }, (_, index) =>
      tx({ id: `a${index}`, amount: 100, date: `2026-08-${String(index + 10).padStart(2, '0')}` }),
    );
    const september = Array.from({ length: 12 }, (_, index) =>
      tx({ id: `s${index}`, amount: 100, date: `2026-09-${String(index + 1).padStart(2, '0')}` }),
    );
    const data = dataWith([...august, ...september]);
    const def = { kind: 'month', startDay: 1 } as const;
    const closed = homeView({
      data,
      today: '2026-09-15',
      def,
      period: {
        range: { start: '2026-08-01', end: '2026-08-31' },
        isCurrent: false,
        elapsed: 31,
        length: 31,
      },
    });
    const current = homeView({
      data,
      today: '2026-09-15',
      def,
      period: {
        range: { start: '2026-09-01', end: '2026-09-30' },
        isCurrent: true,
        elapsed: 15,
        length: 30,
      },
    });
    expect(closed.recent).toHaveLength(10);
    expect(current.recent).toHaveLength(5);
  });
});
