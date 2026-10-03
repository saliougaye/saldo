import { describe, expect, it } from 'vitest';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { getPeriodSummaryTool } from './getPeriodSummary';

const eur = (minor: number, amount: string) => ({ minor, currency: 'EUR', amount });

describe('get_period_summary', () => {
  it('gives the current period with the previous one beside it', () => {
    expect(getPeriodSummaryTool.run(fixtureData(), CONTEXT, {})).toEqual({
      period: {
        start: '2026-09-01',
        end: '2026-09-30',
        isCurrent: true,
        elapsedDays: 15,
        lengthDays: 30,
      },
      income: eur(250000, '2500.00'),
      // Rent, the supermarket and the market: not the excluded row, the transfer or the dinner ahead.
      expenses: eur(87050, '870.50'),
      balance: eur(162950, '1629.50'),
      committed: {
        amount: eur(80000, '800.00'),
        sharePercent: 92,
        discretionary: eur(7050, '70.50'),
      },
      previous: {
        start: '2026-08-01',
        end: '2026-08-31',
        income: eur(250000, '2500.00'),
        expenses: eur(95000, '950.00'),
        balance: eur(155000, '1550.00'),
      },
    });
  });

  it('reads a closed period as closed', () => {
    const result = getPeriodSummaryTool.run(fixtureData(), CONTEXT, { period: 'previous' });
    expect(result.period).toMatchObject({ isCurrent: false, elapsedDays: 31, lengthDays: 31 });
    expect(result.previous?.start).toBe('2026-07-01');
  });

  it('has no previous period for an explicit range', () => {
    const result = getPeriodSummaryTool.run(fixtureData(), CONTEXT, {
      from: '2026-09-01',
      to: '2026-09-07',
    });
    expect(result.expenses.minor).toBe(80000);
    expect(result.previous).toBeNull();
  });
});
