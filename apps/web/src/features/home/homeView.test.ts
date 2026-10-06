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
});
