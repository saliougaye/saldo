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
});
