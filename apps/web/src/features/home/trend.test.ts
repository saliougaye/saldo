import { describePeriod } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { tx } from '../test/fixtures';
import { homeTrend } from './trend';

const DEF = { kind: 'month', startDay: 1 } as const;
const TODAY = '2026-09-15';
const SEPTEMBER = describePeriod({ start: '2026-09-01', end: '2026-09-30' }, TODAY);

describe('homeTrend', () => {
  it('draws «il solito» across the whole period and the current line up to today', () => {
    const trend = homeTrend(
      [
        tx({ id: 'aug', amount: 3000, date: '2026-08-01' }),
        tx({ id: 'sep', amount: 5000, date: '2026-09-02' }),
      ],
      DEF,
      SEPTEMBER,
      TODAY,
    );
    expect(trend.current).toHaveLength(15);
    expect(trend.usual).toHaveLength(30);
  });

  it('compares the two lines on the same day', () => {
    const trend = homeTrend(
      [
        tx({ id: 'aug', amount: 3000, date: '2026-08-01' }),
        tx({ id: 'sep', amount: 5000, date: '2026-09-02' }),
      ],
      DEF,
      SEPTEMBER,
      TODAY,
    );
    // August spent 3000 on its first day, so «il solito» is 3000 on every day; September is 5000.
    expect(trend.delta).toBe(2000);
  });

  it('has no comparison with no period before', () => {
    const trend = homeTrend(
      [tx({ id: 'sep', amount: 5000, date: '2026-09-02' })],
      DEF,
      SEPTEMBER,
      TODAY,
    );
    expect(trend.delta).toBeNull();
  });
});
